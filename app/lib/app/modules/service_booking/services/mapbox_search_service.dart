import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';

import '../../../utils/env_service.dart';
import '../models/mapbox_place_model.dart';

enum MapboxSearchCondition { carWash, evCharging, both }

class MapboxSearchService {
  MapboxSearchService({Dio? dio}) : _dio = dio ?? Dio();

  final Dio _dio;
  static const Uuid _uuid = Uuid();

  static const String _baseUrl =
      'https://api.mapbox.com/geocoding/v5/mapbox.places';
  static const String _searchboxSuggestUrl =
      'https://api.mapbox.com/search/searchbox/v1/suggest';
  static const String _searchboxRetrieveBaseUrl =
      'https://api.mapbox.com/search/searchbox/v1/retrieve';
  static const String _googlePlacesNearbyUrl =
      'https://places.googleapis.com/v1/places:searchNearby';
  static const String _googlePlacesTextSearchUrl =
      'https://places.googleapis.com/v1/places:searchText';
  static const String _googlePlacesLegacyNearbyUrl =
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
  static const String _googlePlacesLegacyDetailsUrl =
      'https://maps.googleapis.com/maps/api/place/details/json';
  static const String _googlePlacesAutocompleteUrl =
      'https://places.googleapis.com/v1/places:autocomplete';
  static const String _googlePlacesLegacyAutocompleteUrl =
      'https://maps.googleapis.com/maps/api/place/autocomplete/json';

  /// Google only exposes generic `car_wash` — filter out self-serve / hand / detail shops.
  static const List<String> _nonAutomaticCarWashTerms = [
    'self service',
    'self-service',
    'self serve',
    'coin op',
    'coin operated',
    'coin-operated',
    'hand wash',
    'handwash',
    'hand car wash',
    'detailing',
    'detail shop',
    'auto detail',
    'mobile wash',
    'mobile detailing',
    'truck wash',
    'fleet wash',
    'pressure wash',
    'power wash',
    'manual wash',
    'do it yourself',
    'diy wash',
    'wand wash',
  ];

  static const List<String> _automaticCarWashTerms = [
    'automatic',
    'auto wash',
    'express wash',
    'express car wash',
    'tunnel wash',
    'tunnel car',
    'drive thru',
    'drive-through',
    'drive through',
    'touchless',
    'conveyor',
    'soft cloth',
    'in-bay automatic',
  ];

  static const String _googleCarWashFieldMask =
      'places.displayName,places.formattedAddress,places.location,places.name,places.websiteUri';

  String _carWashSearchText(MapboxPlaceModel place) =>
      '${place.name} ${place.address}'.toLowerCase();

  bool _isAutomaticCarWashPlace(MapboxPlaceModel place) {
    final text = _carWashSearchText(place);
    for (final term in _nonAutomaticCarWashTerms) {
      if (text.contains(term)) return false;
    }
    for (final term in _automaticCarWashTerms) {
      if (text.contains(term)) return true;
    }
    // Generic car-wash POIs from Google are usually automatic tunnel / in-bay.
    return text.contains('car wash') ||
        text.contains('carwash') ||
        text.contains('auto spa');
  }

  List<MapboxPlaceModel> _filterAutomaticCarWashPlaces(
    List<MapboxPlaceModel> places, {
    required int limit,
  }) {
    final filtered = places
        .where(_isAutomaticCarWashPlace)
        .toList(growable: false);
    if (filtered.length <= limit) return filtered;
    return filtered.sublist(0, limit);
  }

  MapboxPlaceModel? _mapGoogleCarWashPlace(Map<String, dynamic> p) {
    final loc = (p['location'] as Map?)?.cast<String, dynamic>();
    final lat = _toDouble(loc?['latitude']) ?? 0.0;
    final lng = _toDouble(loc?['longitude']) ?? 0.0;
    final rawName = _asTrimmedString(p['name']);
    final placeId = rawName.startsWith('places/')
        ? rawName.substring('places/'.length)
        : rawName;
    final websiteUri = _asTrimmedString(p['websiteUri']);
    final place = MapboxPlaceModel(
      name: _asTrimmedString((p['displayName'] as Map?)?['text']),
      address: _asTrimmedString(p['formattedAddress']),
      latitude: lat,
      longitude: lng,
      category: 'car_wash',
      placeId: placeId.isEmpty ? null : placeId,
      websiteUri: websiteUri.isEmpty ? null : websiteUri,
    );
    if (place.name.isEmpty ||
        place.address.isEmpty ||
        place.latitude == 0.0 ||
        place.longitude == 0.0) {
      return null;
    }
    return place;
  }

  List<MapboxPlaceModel> _parseGoogleCarWashPlaces(List<dynamic> rawPlaces) {
    return rawPlaces
        .whereType<Map<String, dynamic>>()
        .map(_mapGoogleCarWashPlace)
        .whereType<MapboxPlaceModel>()
        .toList(growable: false);
  }

  Future<List<MapboxPlaceModel>> searchNearbyPlaces({
    required double latitude,
    required double longitude,
    required MapboxSearchCondition condition,
    int limit = 10,
    String? accessToken,
    String? preferredEvChargerType,
  }) async {
    final safeLimit = limit.clamp(1, 50);

    switch (condition) {
      /// CAR WASH → Google Places (New)
      case MapboxSearchCondition.carWash:
        return _searchCarWashPlacesViaGoogle(
          latitude: latitude,
          longitude: longitude,
          limit: safeLimit,
        );

      /// EV CHARGING → Google Places (New), same pattern as car wash
      case MapboxSearchCondition.evCharging:
        return _searchEvChargingPlacesViaGoogle(
          latitude: latitude,
          longitude: longitude,
          limit: safeLimit,
          preferredEvChargerType: preferredEvChargerType,
        );

      /// BOTH → Car wash + EV charging from Google Places
      case MapboxSearchCondition.both:
        final responses = await Future.wait([
          _searchCarWashPlacesViaGoogle(
            latitude: latitude,
            longitude: longitude,
            limit: safeLimit,
          ),
          _searchEvChargingPlacesViaGoogle(
            latitude: latitude,
            longitude: longitude,
            limit: safeLimit,
            preferredEvChargerType: preferredEvChargerType,
          ),
        ]);

        return _mergeUniquePlaces(responses.expand((e) => e).toList());
    }
  }

  Future<List<MapboxPlaceModel>> _searchCarWashPlacesViaGoogle({
    required double latitude,
    required double longitude,
    required int limit,
  }) async {
    final apiKey = EnvService.googlePlacesApiKey.trim();
    if (apiKey.isEmpty) {
      throw Exception('Google Places API key is missing.');
    }

    final safeLimit = limit.clamp(1, 20);
    final fetchLimit = (safeLimit * 2).clamp(safeLimit, 20);
    try {
      final nearbyFuture = _dio.post(
        _googlePlacesNearbyUrl,
        data: <String, dynamic>{
          'includedTypes': ['car_wash'],
          'maxResultCount': fetchLimit,
          'rankPreference': 'DISTANCE',
          'locationRestriction': {
            'circle': {
              'center': {'latitude': latitude, 'longitude': longitude},
              'radius': 10000.0,
            },
          },
          'regionCode': 'US',
          'languageCode': 'en',
        },
        options: Options(
          headers: <String, dynamic>{
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': _googleCarWashFieldMask,
          },
        ),
      );
      final textFuture = _searchAutomaticCarWashViaGoogleText(
        latitude: latitude,
        longitude: longitude,
        limit: fetchLimit,
        apiKey: apiKey,
      );

      final response = await nearbyFuture;
      if (response.statusCode != 200) {
        throw Exception(
          'Google Places request failed with status ${response.statusCode}.',
        );
      }

      final data = response.data;
      if (data is! Map<String, dynamic>) return const [];
      final places = (data['places'] as List?) ?? const [];
      final nearbyParsed = _parseGoogleCarWashPlaces(places);

      List<MapboxPlaceModel> textParsed = const [];
      try {
        textParsed = await textFuture;
      } catch (e) {
        debugPrint('[GooglePlacesText] automatic car wash search failed: $e');
      }

      final merged = _mergeUniquePlaces([...textParsed, ...nearbyParsed]);
      merged.sort(
        (a, b) =>
            _distanceInMiles(
              fromLat: latitude,
              fromLon: longitude,
              toLat: a.latitude,
              toLon: a.longitude,
            ).compareTo(
              _distanceInMiles(
                fromLat: latitude,
                fromLon: longitude,
                toLat: b.latitude,
                toLon: b.longitude,
              ),
            ),
      );
      return _filterAutomaticCarWashPlaces(merged, limit: safeLimit);
    } on DioException catch (e) {
      debugPrint(
        '[GooglePlacesNew] failed, falling back to legacy API: ${e.message}',
      );
      try {
        return await _searchCarWashPlacesViaGoogleLegacy(
          latitude: latitude,
          longitude: longitude,
          limit: limit,
          apiKey: apiKey,
        );
      } catch (_) {
        final message = e.response?.data is Map
            ? ((e.response?.data['error']?['message'] ?? '') as String)
            : (e.message ?? 'Unknown network error');
        throw Exception('Google Places API error: $message');
      }
    } catch (_) {
      return _searchCarWashPlacesViaGoogleLegacy(
        latitude: latitude,
        longitude: longitude,
        limit: limit,
        apiKey: apiKey,
      );
    }
  }

  Future<List<MapboxPlaceModel>> _searchAutomaticCarWashViaGoogleText({
    required double latitude,
    required double longitude,
    required int limit,
    required String apiKey,
  }) async {
    final safeLimit = limit.clamp(1, 20);
    final response = await _dio.post(
      _googlePlacesTextSearchUrl,
      data: <String, dynamic>{
        'textQuery': 'automatic car wash',
        'includedType': 'car_wash',
        'maxResultCount': safeLimit,
        'locationBias': {
          'circle': {
            'center': {'latitude': latitude, 'longitude': longitude},
            'radius': 10000.0,
          },
        },
        'regionCode': 'US',
        'languageCode': 'en',
      },
      options: Options(
        headers: <String, dynamic>{
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': _googleCarWashFieldMask,
        },
      ),
    );
    if (response.statusCode != 200) {
      throw Exception(
        'Google Places text search failed with status ${response.statusCode}.',
      );
    }
    final data = response.data;
    if (data is! Map<String, dynamic>) return const [];
    final places = (data['places'] as List?) ?? const [];
    return _parseGoogleCarWashPlaces(places);
  }

  Future<List<MapboxPlaceModel>> _searchCarWashPlacesViaGoogleLegacy({
    required double latitude,
    required double longitude,
    required int limit,
    required String apiKey,
  }) async {
    final response = await _dio.get(
      _googlePlacesLegacyNearbyUrl,
      queryParameters: <String, dynamic>{
        'location': '$latitude,$longitude',
        'radius': 10000,
        'type': 'car_wash',
        'key': apiKey,
      },
    );
    if (response.statusCode != 200) {
      throw Exception(
        'Google Places legacy request failed with status ${response.statusCode}.',
      );
    }
    final data = response.data;
    if (data is! Map<String, dynamic>) return const [];
    final results = (data['results'] as List?) ?? const [];
    final parsed = results
        .whereType<Map<String, dynamic>>()
        .map((p) {
          final geo = (p['geometry'] as Map?)?.cast<String, dynamic>();
          final loc = (geo?['location'] as Map?)?.cast<String, dynamic>();
          final lat = _toDouble(loc?['lat']) ?? 0.0;
          final lng = _toDouble(loc?['lng']) ?? 0.0;
          final placeId = _asTrimmedString(p['place_id']);
          return MapboxPlaceModel(
            name: _asTrimmedString(p['name']),
            address: _asTrimmedString(p['vicinity'] ?? p['formatted_address']),
            latitude: lat,
            longitude: lng,
            category: 'car_wash',
            placeId: placeId.isEmpty ? null : placeId,
          );
        })
        .where((p) {
          return p.name.isNotEmpty &&
              p.address.isNotEmpty &&
              p.latitude != 0.0 &&
              p.longitude != 0.0;
        })
        .toList(growable: false);
    return _filterAutomaticCarWashPlaces(parsed, limit: limit);
  }

  Future<String?> fetchPlaceWebsiteByPlaceId({required String placeId}) async {
    final apiKey = EnvService.googlePlacesApiKey.trim();
    if (apiKey.isEmpty) {
      throw Exception('Google Places API key is missing.');
    }
    final normalizedPlaceId = placeId.trim().replaceFirst('places/', '');
    if (normalizedPlaceId.isEmpty) return null;

    try {
      final response = await _dio.get(
        'https://places.googleapis.com/v1/places/$normalizedPlaceId',
        options: Options(
          headers: <String, dynamic>{
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'displayName,formattedAddress,websiteUri',
          },
        ),
      );
      if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
        final website = _asTrimmedString(
          (response.data as Map<String, dynamic>)['websiteUri'],
        );
        if (website.isNotEmpty) return website;
      }
    } catch (_) {
      // Fallback to legacy details below.
    }

    final legacy = await _dio.get(
      _googlePlacesLegacyDetailsUrl,
      queryParameters: <String, dynamic>{
        'place_id': normalizedPlaceId,
        'fields': 'name,formatted_address,website',
        'key': apiKey,
      },
    );
    if (legacy.statusCode != 200) return null;
    final data = legacy.data;
    if (data is! Map<String, dynamic>) return null;
    final result = (data['result'] as Map?)?.cast<String, dynamic>();
    final website = _asTrimmedString(result?['website']);
    return website.isEmpty ? null : website;
  }

  Future<List<MapboxPlaceModel>> _searchCarWashPlaces({
    required double latitude,
    required double longitude,
    required int limit,
    required String accessToken,
  }) async {
    // Mapbox geocoding returns a limited set per query, so use multiple
    // car-wash related keywords and merge to build a more complete list.
    const keywords = <String>[
      'automatic car wash',
      'express car wash',
      'tunnel car wash',
    ];
    final perKeywordLimit = ((limit / keywords.length).ceil() + 2).clamp(4, 10);
    final responses = await Future.wait(
      keywords.map(
        (keyword) => _searchByKeyword(
          keyword: keyword,
          category: 'car_wash',
          latitude: latitude,
          longitude: longitude,
          limit: perKeywordLimit,
          accessToken: accessToken,
        ),
      ),
    );
    final merged = _mergeUniquePlaces(
      responses.expand((items) => items).toList(growable: false),
    );
    merged.sort(
      (a, b) =>
          _distanceInMiles(
            fromLat: latitude,
            fromLon: longitude,
            toLat: a.latitude,
            toLon: a.longitude,
          ).compareTo(
            _distanceInMiles(
              fromLat: latitude,
              fromLon: longitude,
              toLat: b.latitude,
              toLon: b.longitude,
            ),
          ),
    );
    return _filterAutomaticCarWashPlaces(merged, limit: limit);
  }

  Future<List<MapboxPlaceModel>> searchGoogleAddressSuggestions({
    required String query,
    double? latitude,
    double? longitude,
    int limit = 5,
    String? sessionToken,
  }) async {
    final apiKey = EnvService.googlePlacesApiKey.trim();
    if (apiKey.isEmpty) {
      throw Exception('Google Places API key is missing.');
    }
    final cleaned = query.trim();
    if (cleaned.isEmpty) return const [];

    final safeLimit = limit.clamp(1, 10);
    try {
      final parsed = await _searchGoogleAddressSuggestionsNew(
        query: cleaned,
        latitude: latitude,
        longitude: longitude,
        limit: safeLimit,
        apiKey: apiKey,
        sessionToken: sessionToken,
      );
      if (parsed.isNotEmpty) return parsed;
    } on DioException catch (e) {
      debugPrint(
        '[GooglePlacesAutocomplete] new API failed, falling back: ${e.message}',
      );
    } catch (e) {
      debugPrint('[GooglePlacesAutocomplete] new API error: $e');
    }

    return _searchGoogleAddressSuggestionsLegacy(
      query: cleaned,
      latitude: latitude,
      longitude: longitude,
      limit: safeLimit,
      apiKey: apiKey,
      sessionToken: sessionToken,
    );
  }

  Future<MapboxPlaceModel?> fetchGooglePlaceAddress({
    required String placeId,
    String? sessionToken,
  }) async {
    final apiKey = EnvService.googlePlacesApiKey.trim();
    if (apiKey.isEmpty) {
      throw Exception('Google Places API key is missing.');
    }
    final normalizedPlaceId = placeId.trim().replaceFirst('places/', '');
    if (normalizedPlaceId.isEmpty) return null;

    try {
      final response = await _dio.get(
        'https://places.googleapis.com/v1/places/$normalizedPlaceId',
        options: Options(
          headers: <String, dynamic>{
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'displayName,formattedAddress,location',
            if (sessionToken != null && sessionToken.isNotEmpty)
              'X-Goog-Session-Token': sessionToken,
          },
        ),
      );
      if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
        final data = response.data as Map<String, dynamic>;
        final loc = (data['location'] as Map?)?.cast<String, dynamic>();
        final lat = _toDouble(loc?['latitude']) ?? 0.0;
        final lng = _toDouble(loc?['longitude']) ?? 0.0;
        final address = _asTrimmedString(data['formattedAddress']);
        final name = _asTrimmedString((data['displayName'] as Map?)?['text']);
        if (address.isEmpty) return null;
        return MapboxPlaceModel(
          name: name.isNotEmpty ? name : address,
          address: address,
          latitude: lat,
          longitude: lng,
          category: 'google_address',
          placeId: normalizedPlaceId,
        );
      }
    } catch (_) {
      // Fallback to legacy details below.
    }

    final legacy = await _dio.get(
      _googlePlacesLegacyDetailsUrl,
      queryParameters: <String, dynamic>{
        'place_id': normalizedPlaceId,
        'fields': 'name,formatted_address,geometry',
        'key': apiKey,
        if (sessionToken != null && sessionToken.isNotEmpty)
          'sessiontoken': sessionToken,
      },
    );
    if (legacy.statusCode != 200) return null;
    final data = legacy.data;
    if (data is! Map<String, dynamic>) return null;
    final result = (data['result'] as Map?)?.cast<String, dynamic>();
    if (result == null) return null;
    final geometry = (result['geometry'] as Map?)?.cast<String, dynamic>();
    final loc = (geometry?['location'] as Map?)?.cast<String, dynamic>();
    final address = _asTrimmedString(result['formatted_address']);
    final name = _asTrimmedString(result['name']);
    if (address.isEmpty) return null;
    return MapboxPlaceModel(
      name: name.isNotEmpty ? name : address,
      address: address,
      latitude: _toDouble(loc?['lat']) ?? 0.0,
      longitude: _toDouble(loc?['lng']) ?? 0.0,
      category: 'google_address',
      placeId: normalizedPlaceId,
    );
  }

  Future<List<MapboxPlaceModel>> _searchGoogleAddressSuggestionsNew({
    required String query,
    double? latitude,
    double? longitude,
    required int limit,
    required String apiKey,
    String? sessionToken,
  }) async {
    final body = <String, dynamic>{
      'input': query,
      'includedRegionCodes': <String>['us'],
    };
    if (latitude != null && longitude != null) {
      body['locationBias'] = <String, dynamic>{
        'circle': <String, dynamic>{
          'center': <String, dynamic>{
            'latitude': latitude,
            'longitude': longitude,
          },
          'radius': 50000.0,
        },
      };
    }
    if (sessionToken != null && sessionToken.isNotEmpty) {
      body['sessionToken'] = sessionToken;
    }

    final response = await _dio.post(
      _googlePlacesAutocompleteUrl,
      data: body,
      options: Options(
        headers: <String, dynamic>{
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
              'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
        },
      ),
    );
    if (response.statusCode != 200) {
      throw DioException(
        requestOptions: response.requestOptions,
        response: response,
        message:
            'Google Places autocomplete failed with status ${response.statusCode}.',
      );
    }
    final data = response.data;
    if (data is! Map<String, dynamic>) return const [];
    final suggestions = (data['suggestions'] as List?) ?? const [];
    final parsed = <MapboxPlaceModel>[];
    for (final item in suggestions) {
      if (item is! Map<String, dynamic>) continue;
      final prediction = (item['placePrediction'] as Map?)
          ?.cast<String, dynamic>();
      if (prediction == null) continue;
      final placeId = _asTrimmedString(prediction['placeId']);
      final text = _asTrimmedString((prediction['text'] as Map?)?['text']);
      final structured = (prediction['structuredFormat'] as Map?)
          ?.cast<String, dynamic>();
      final mainText = _asTrimmedString(
        (structured?['mainText'] as Map?)?['text'],
      );
      final secondaryText = _asTrimmedString(
        (structured?['secondaryText'] as Map?)?['text'],
      );
      final address = text.isNotEmpty
          ? text
          : <String>[
              mainText,
              secondaryText,
            ].where((part) => part.isNotEmpty).join(', ');
      if (address.isEmpty) continue;
      parsed.add(
        MapboxPlaceModel(
          name: mainText.isNotEmpty ? mainText : address,
          address: address,
          latitude: 0,
          longitude: 0,
          category: 'google_address',
          placeId: placeId.isNotEmpty ? placeId : null,
        ),
      );
      if (parsed.length >= limit) break;
    }
    return parsed;
  }

  Future<List<MapboxPlaceModel>> _searchGoogleAddressSuggestionsLegacy({
    required String query,
    double? latitude,
    double? longitude,
    required int limit,
    required String apiKey,
    String? sessionToken,
  }) async {
    final params = <String, dynamic>{
      'input': query,
      'key': apiKey,
      'types': 'address',
      'components': 'country:us',
    };
    if (latitude != null && longitude != null) {
      params['location'] = '$latitude,$longitude';
      params['radius'] = 50000;
    }
    if (sessionToken != null && sessionToken.isNotEmpty) {
      params['sessiontoken'] = sessionToken;
    }

    final response = await _dio.get(
      _googlePlacesLegacyAutocompleteUrl,
      queryParameters: params,
    );
    if (response.statusCode != 200) {
      throw Exception(
        'Google Places legacy autocomplete failed with status ${response.statusCode}.',
      );
    }
    final data = response.data;
    if (data is! Map<String, dynamic>) return const [];
    if ((data['status'] as String?) == 'REQUEST_DENIED') {
      throw Exception(
        _asTrimmedString(data['error_message']).isNotEmpty
            ? _asTrimmedString(data['error_message'])
            : 'Google Places autocomplete request denied.',
      );
    }
    final predictions = (data['predictions'] as List?) ?? const [];
    final parsed = <MapboxPlaceModel>[];
    for (final item in predictions) {
      if (item is! Map<String, dynamic>) continue;
      final description = _asTrimmedString(item['description']);
      if (description.isEmpty) continue;
      final structured = (item['structured_formatting'] as Map?)
          ?.cast<String, dynamic>();
      final mainText = _asTrimmedString(structured?['main_text']);
      parsed.add(
        MapboxPlaceModel(
          name: mainText.isNotEmpty ? mainText : description,
          address: description,
          latitude: 0,
          longitude: 0,
          category: 'google_address',
          placeId: _asTrimmedString(item['place_id']).isNotEmpty
              ? _asTrimmedString(item['place_id'])
              : null,
        ),
      );
      if (parsed.length >= limit) break;
    }
    return parsed;
  }

  Future<List<MapboxPlaceModel>> searchAddressSuggestions({
    required String query,
    double? latitude,
    double? longitude,
    int limit = 5,
    String? accessToken,
  }) async {
    final token = (accessToken ?? EnvService.mapboxAccessToken).trim();
    if (token.isEmpty) {
      throw Exception('Mapbox access token is missing.');
    }
    final cleaned = query.trim();
    if (cleaned.isEmpty) return const [];

    final safeLimit = limit.clamp(1, 10);
    final encodedQuery = Uri.encodeComponent(cleaned);
    final params = <String, dynamic>{
      'autocomplete': true,
      'types': 'address,place,poi',
      'limit': safeLimit,
      // 'country': 'US',
      'access_token': token,
    };
    if (latitude != null && longitude != null) {
      params['proximity'] = '$longitude,$latitude';
    }

    try {
      final response = await _dio.get(
        '$_baseUrl/$encodedQuery.json',
        queryParameters: params,
      );
      if (response.statusCode != 200) {
        throw Exception(
          'Mapbox request failed with status ${response.statusCode}.',
        );
      }
      final data = response.data;
      if (data is! Map<String, dynamic>) return const [];
      final features = (data['features'] as List?) ?? const [];
      return features
          .whereType<Map<String, dynamic>>()
          .map(
            (feature) => MapboxPlaceModel.fromMapboxFeature(
              feature,
              fallbackCategory: 'manual_address',
            ),
          )
          .where((place) => place.address.isNotEmpty)
          .toList(growable: false);
    } on DioException catch (e) {
      final message = e.response?.data is Map
          ? ((e.response?.data['message'] ?? '') as String)
          : (e.message ?? 'Unknown network error');
      throw Exception('Mapbox autocomplete error: $message');
    }
  }

  Future<List<MapboxPlaceModel>> _searchEvChargingPlacesViaGoogle({
    required double latitude,
    required double longitude,
    required int limit,
    String? preferredEvChargerType,
  }) async {
    final apiKey = EnvService.googlePlacesApiKey.trim();
    if (apiKey.isEmpty) {
      throw Exception('Google Places API key is missing.');
    }

    final safeLimit = limit.clamp(1, 20);
    try {
      var parsed = await _searchEvChargingPlacesGoogleNew(
        latitude: latitude,
        longitude: longitude,
        safeLimit: safeLimit,
        apiKey: apiKey,
        includeEvChargeOptions: true,
        preferredEvChargerType: preferredEvChargerType,
      );
      if (parsed.isEmpty) {
        parsed = await _searchEvChargingPlacesGoogleNew(
          latitude: latitude,
          longitude: longitude,
          safeLimit: safeLimit,
          apiKey: apiKey,
          includeEvChargeOptions: false,
          preferredEvChargerType: preferredEvChargerType,
        );
      }
      if (parsed.isNotEmpty) return parsed;
    } on DioException catch (e) {
      if (e.response?.statusCode == 400) {
        try {
          final parsed = await _searchEvChargingPlacesGoogleNew(
            latitude: latitude,
            longitude: longitude,
            safeLimit: safeLimit,
            apiKey: apiKey,
            includeEvChargeOptions: false,
            preferredEvChargerType: preferredEvChargerType,
          );
          if (parsed.isNotEmpty) return parsed;
        } catch (_) {
          // Fall through to legacy.
        }
      }
      debugPrint(
        '[GooglePlacesEV] new API failed, falling back to legacy: ${e.message}',
      );
    } catch (e) {
      debugPrint('[GooglePlacesEV] new API error: $e');
    }

    return _searchEvChargingPlacesViaGoogleLegacy(
      latitude: latitude,
      longitude: longitude,
      limit: limit,
      apiKey: apiKey,
      preferredEvChargerType: preferredEvChargerType,
    );
  }

  Future<List<MapboxPlaceModel>> _searchEvChargingPlacesGoogleNew({
    required double latitude,
    required double longitude,
    required int safeLimit,
    required String apiKey,
    required bool includeEvChargeOptions,
    String? preferredEvChargerType,
  }) async {
    // Always include evChargeOptions so we can filter by connector type.
    // We fetch up to 20 results (API max) so the CCS1 filter has enough
    // candidates to work with even in areas with mixed charger types.
    const fieldMask =
        'places.displayName,places.formattedAddress,places.location,places.name,places.websiteUri,places.evChargeOptions';
    final fetchLimit = 20; // always fetch max; we filter down after

    final response = await _dio.post(
      _googlePlacesNearbyUrl,
      data: <String, dynamic>{
        'includedTypes': ['electric_vehicle_charging_station'],
        'maxResultCount': fetchLimit,
        'rankPreference': 'DISTANCE',
        'locationRestriction': {
          'circle': {
            'center': {'latitude': latitude, 'longitude': longitude},
            // Widen radius to 25 km to find DC fast chargers which are
            // less dense than Level 2 stations.
            'radius': 25000.0,
          },
        },
        'languageCode': 'en',
      },
      options: Options(
        headers: <String, dynamic>{
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
      ),
    );

    if (response.statusCode != 200) {
      throw Exception(
        'Google Places request failed with status ${response.statusCode}.',
      );
    }

    final data = response.data;
    if (data is! Map<String, dynamic>) return const [];
    final places = (data['places'] as List?) ?? const [];
    // Return up to safeLimit results after filtering
    final allMapped = places
        .whereType<Map<String, dynamic>>()
        .map(_mapGoogleNearbyPlaceToEvChargingModel)
        .where(
          (place) =>
              place.name.isNotEmpty &&
              place.address.isNotEmpty &&
              place.latitude != 0.0 &&
              place.longitude != 0.0,
        )
        .toList(growable: false);

    final sorted = _filterAndSortEvStations(
      allMapped,
      preferredChargerType: preferredEvChargerType,
    );
    return sorted.length > safeLimit ? sorted.sublist(0, safeLimit) : sorted;
  }

  /// Keeps the requested charger type at the top in Google distance order,
  /// then applies the normal fast-charger ranking to every remaining station.
  ///
  /// Tier 1 — Confirmed CCS1 DC Fast (≥50 kW, connector type verified by Google)
  ///          sorted fastest-first within the tier.
  /// Tier 2 — Unverified fast (≥50 kW overall, but Google returned no connector-
  ///          type data so the mix is unknown — may or may not include CCS1).
  ///          Sorted fastest-first. Stations that HAD connector data but no
  ///          CCS1 match (e.g. Tesla NACS-only, CHAdeMO-only) are excluded.
  /// Tier 3 — Everything else (Level 2, slower chargers, unknown speed).
  ///          Sorted fastest-first by whatever kW data is available.
  ///
  /// Nothing is hidden — all stations are returned, just in priority order.
  List<MapboxPlaceModel> _filterAndSortEvStations(
    List<MapboxPlaceModel> stations, {
    String? preferredChargerType,
  }) {
    if (stations.isEmpty) return stations;

    final preferred = _preferredEvStations(
      stations,
      preferredChargerType: preferredChargerType,
    );
    if (preferred.isNotEmpty) {
      final remaining = stations
          .where((station) => !preferred.contains(station))
          .toList();
      return [...preferred, ..._filterAndSortEvStations(remaining)];
    }

    // Stations where Google returned connector-type data (ccs1 fields set,
    // even if ccs1MaxKw is null meaning no CCS1 connector was found).
    final hasConnectorData = stations
        .where((s) => s.ccs1ConnectorCount != null || s.ccs1MaxKw != null)
        .toSet();

    // Tier 1: confirmed CCS1 DC Fast (≥50 kW)
    final tier1 = stations.where((s) => s.hasCcs1DcFast).toList();

    // Tier 2: no connector-type data from Google, but overall speed ≥50 kW.
    // Excludes stations that had connector data but zero CCS1 hits.
    final tier2 = stations
        .where(
          (s) =>
              !tier1.contains(s) &&
              !hasConnectorData.contains(s) &&
              (s.maxChargingPowerKw ?? 0) >= 50,
        )
        .toList();

    // Tier 3: everything else — lower speed, unknown speed, or confirmed
    // non-CCS1 (Tesla NACS-only, CHAdeMO-only, Level 1/2).
    final tier3 = stations
        .where((s) => !tier1.contains(s) && !tier2.contains(s))
        .toList();

    return [
      ..._sortBySpeedDesc(tier1),
      ..._sortBySpeedDesc(tier2),
      ..._sortBySpeedDesc(tier3),
    ];
  }

  List<MapboxPlaceModel> _preferredEvStations(
    List<MapboxPlaceModel> stations, {
    String? preferredChargerType,
  }) {
    final preferred = preferredChargerType?.trim().toLowerCase();
    if (preferred == 'tesla_supercharger') {
      // Google Nearby Search is requested with DISTANCE ranking, so retaining
      // this order makes the first two Tesla results the closest ones.
      return stations.where(_isTeslaSupercharger).toList(growable: false);
    }
    if (preferred == 'dc_fast_charger') {
      return stations.where(_isDcFastCharger).toList(growable: false);
    }
    return const [];
  }

  bool _isTeslaSupercharger(MapboxPlaceModel station) {
    final text =
        '${station.name} ${station.address} ${station.websiteUri ?? ''}'
            .toLowerCase();
    return text.contains('tesla') || text.contains('supercharger');
  }

  bool _isDcFastCharger(MapboxPlaceModel station) {
    final text = '${station.name} ${station.address}'.toLowerCase();
    return station.hasCcs1DcFast ||
        (station.maxChargingPowerKw ?? 0) >= 50 ||
        text.contains('dc fast') ||
        text.contains('fast charger');
  }

  List<MapboxPlaceModel> _sortBySpeedDesc(List<MapboxPlaceModel> stations) {
    final copy = List.of(stations);
    copy.sort((a, b) {
      final aKw = a.ccs1MaxKw ?? a.maxChargingPowerKw ?? 0.0;
      final bKw = b.ccs1MaxKw ?? b.maxChargingPowerKw ?? 0.0;
      return bKw.compareTo(aKw); // descending — fastest first
    });
    return copy;
  }

  MapboxPlaceModel _mapGoogleNearbyPlaceToEvChargingModel(
    Map<String, dynamic> p,
  ) {
    final loc = (p['location'] as Map?)?.cast<String, dynamic>();
    final lat = _toDouble(loc?['latitude']) ?? 0.0;
    final lng = _toDouble(loc?['longitude']) ?? 0.0;
    final resourceName = _asTrimmedString(p['name']);
    final placeId = resourceName.startsWith('places/')
        ? resourceName.substring('places/'.length)
        : resourceName;
    final websiteUri = _asTrimmedString(p['websiteUri']);
    final (totalConnectors, overallMaxKw, ccs1MaxKw, ccs1Count) =
        _parseGoogleEvChargeOptions(p['evChargeOptions']);

    return MapboxPlaceModel(
      name: _asTrimmedString((p['displayName'] as Map?)?['text']),
      address: _asTrimmedString(p['formattedAddress']),
      latitude: lat,
      longitude: lng,
      category: 'ev_charging',
      placeId: placeId.isEmpty ? null : placeId,
      websiteUri: websiteUri.isEmpty ? null : websiteUri,
      availableChargers: totalConnectors,
      maxChargingPowerKw: overallMaxKw,
      ccs1MaxKw: ccs1MaxKw,
      ccs1ConnectorCount: ccs1Count,
    );
  }

  /// Google connector type strings that map to CCS1 (SAE J1772 Combo).
  static const _ccs1TypeStrings = <String>{
    'EV_CONNECTOR_TYPE_CCS_COMBO_1',
    'CCS_COMBO_1',
    'CCS1',
    'CCS_1',
    'SAE_CCS',
    'J1772_COMBO',
  };

  /// Returns (totalConnectors, overallMaxKw, ccs1MaxKw, ccs1ConnectorCount).
  (int?, double?, double?, int?) _parseGoogleEvChargeOptions(dynamic raw) {
    if (raw is! Map) return (null, null, null, null);
    final map = raw.cast<dynamic, dynamic>();
    final agg = map['connectorAggregation'];
    if (agg is! List) return (null, null, null, null);

    var totalConnectors = 0;
    double? overallMaxKw;
    double? ccs1MaxKw;
    var ccs1Count = 0;

    for (final item in agg) {
      if (item is! Map) continue;
      final m = item.cast<dynamic, dynamic>();

      final countRaw = m['count'];
      final count = countRaw is num
          ? countRaw.toInt()
          : int.tryParse('${countRaw ?? 0}'.trim()) ?? 0;
      totalConnectors += count;

      final kw = _toDouble(m['maxChargeRateKw']);
      if (kw != null && kw > 0) {
        if (overallMaxKw == null || kw > overallMaxKw) overallMaxKw = kw;
      }

      // Check connector type for CCS1
      final typeRaw = '${m['type'] ?? m['connectorType'] ?? ''}'
          .trim()
          .toUpperCase();
      final isCcs1 = _ccs1TypeStrings.any((t) => typeRaw.contains(t));
      if (isCcs1 && kw != null && kw > 0) {
        ccs1Count += count;
        if (ccs1MaxKw == null || kw > ccs1MaxKw) ccs1MaxKw = kw;
      }
    }

    return (
      totalConnectors > 0 ? totalConnectors : null,
      overallMaxKw,
      ccs1MaxKw,
      ccs1Count > 0 ? ccs1Count : null,
    );
  }

  Future<List<MapboxPlaceModel>> _searchEvChargingPlacesViaGoogleLegacy({
    required double latitude,
    required double longitude,
    required int limit,
    required String apiKey,
    String? preferredEvChargerType,
  }) async {
    final response = await _dio.get(
      _googlePlacesLegacyNearbyUrl,
      queryParameters: <String, dynamic>{
        'location': '$latitude,$longitude',
        'radius': 10000,
        'type': 'electric_vehicle_charging_station',
        'key': apiKey,
      },
    );
    if (response.statusCode != 200) {
      throw Exception(
        'Google Places legacy request failed with status ${response.statusCode}.',
      );
    }
    final data = response.data;
    if (data is! Map<String, dynamic>) return const [];
    final results = (data['results'] as List?) ?? const [];
    final parsed = results
        .whereType<Map<String, dynamic>>()
        .map((p) {
          final geo = (p['geometry'] as Map?)?.cast<String, dynamic>();
          final loc = (geo?['location'] as Map?)?.cast<String, dynamic>();
          final lat = _toDouble(loc?['lat']) ?? 0.0;
          final lng = _toDouble(loc?['lng']) ?? 0.0;
          final pid = _asTrimmedString(p['place_id']);
          return MapboxPlaceModel(
            name: _asTrimmedString(p['name']),
            address: _asTrimmedString(p['vicinity'] ?? p['formatted_address']),
            latitude: lat,
            longitude: lng,
            category: 'ev_charging',
            placeId: pid.isEmpty ? null : pid,
          );
        })
        .where(
          (p) =>
              p.name.isNotEmpty &&
              p.address.isNotEmpty &&
              p.latitude != 0.0 &&
              p.longitude != 0.0,
        )
        .toList(growable: false);
    // Legacy API doesn't return connector types — sort by whatever kW we have
    // and return up to limit. The new API path handles CCS1 filtering.
    final sorted = _filterAndSortEvStations(
      parsed,
      preferredChargerType: preferredEvChargerType,
    );
    return sorted.length <= limit ? sorted : sorted.sublist(0, limit);
  }

  double _distanceInMiles({
    required double fromLat,
    required double fromLon,
    required double toLat,
    required double toLon,
  }) {
    const earthRadiusMiles = 3958.8;
    final dLat = _toRadians(toLat - fromLat);
    final dLon = _toRadians(toLon - fromLon);
    final a =
        (sin(dLat / 2) * sin(dLat / 2)) +
        cos(_toRadians(fromLat)) *
            cos(_toRadians(toLat)) *
            (sin(dLon / 2) * sin(dLon / 2));
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadiusMiles * c;
  }

  double _toRadians(double degree) => degree * (3.141592653589793 / 180.0);

  double? _toDouble(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value.trim());
    return null;
  }

  String _asTrimmedString(dynamic value) {
    if (value == null) return '';
    if (value is String) return value.trim();
    if (value is num || value is bool) return '$value';
    if (value is Map) {
      final map = value.cast<dynamic, dynamic>();
      final prioritized = [
        map['name'],
        map['full_address'],
        map['place_formatted'],
        map['formatted_address'],
        map['address'],
        map['text'],
      ];
      for (final item in prioritized) {
        final parsed = _asTrimmedString(item);
        if (parsed.isNotEmpty) return parsed;
      }
      return '';
    }
    if (value is List) {
      final parts = value
          .map(_asTrimmedString)
          .where((e) => e.isNotEmpty)
          .toList(growable: false);
      return parts.join(', ').trim();
    }
    return '$value'.trim();
  }

  Future<List<MapboxPlaceModel>> _searchByKeyword({
    required String keyword,
    required String category,
    required double latitude,
    required double longitude,
    required int limit,
    required String accessToken,
  }) async {
    try {
      final encodedKeyword = Uri.encodeComponent(keyword);
      final requestUri = Uri.parse('$_baseUrl/$encodedKeyword.json').replace(
        queryParameters: <String, dynamic>{
          'proximity': '$longitude,$latitude',
          'limit': limit.toString(),
          // 'country': 'US',
          'access_token': accessToken,
        },
      );
      debugPrint('[MapboxSearch] request=$requestUri');
      final response = await _dio.get(
        '$_baseUrl/$encodedKeyword.json',
        queryParameters: <String, dynamic>{
          'proximity': '$longitude,$latitude',
          'limit': limit,
          // 'country': 'US',
          'access_token': accessToken,
        },
      );
      debugPrint('[MapboxSearch] status=${response.statusCode}');
      debugPrint('[MapboxSearch] response=${response.data}');

      if (response.statusCode != 200) {
        throw Exception(
          'Mapbox request failed with status ${response.statusCode}.',
        );
      }

      final data = response.data;
      if (data is! Map<String, dynamic>) return const [];
      final features = (data['features'] as List?) ?? const [];
      return features
          .whereType<Map<String, dynamic>>()
          .map(
            (feature) => MapboxPlaceModel.fromMapboxFeature(
              feature,
              fallbackCategory: category,
            ),
          )
          .where((place) => place.name.isNotEmpty)
          .toList(growable: false);
    } on DioException catch (e) {
      final message = e.response?.data is Map
          ? ((e.response?.data['message'] ?? '') as String)
          : (e.message ?? 'Unknown network error');
      throw Exception('Mapbox API error: $message');
    } catch (e) {
      rethrow;
    }
  }

  Future<List<MapboxPlaceModel>> _searchCarWashViaSearchbox({
    required String keyword,
    required String category,
    required double latitude,
    required double longitude,
    required int limit,
    required String accessToken,
  }) async {
    try {
      final sessionToken = _uuid.v4();
      final requestUri = Uri.parse(_searchboxSuggestUrl).replace(
        queryParameters: <String, dynamic>{
          'q': keyword,
          'proximity': '$longitude,$latitude',
          'limit': limit.toString(),
          'country': 'IN',
          'session_token': sessionToken,
          'access_token': accessToken,
        },
      );
      debugPrint('[MapboxSearchbox] suggest request=$requestUri');

      final response = await _dio.get(
        _searchboxSuggestUrl,
        queryParameters: <String, dynamic>{
          'q': keyword,
          'proximity': '$longitude,$latitude',
          'limit': limit,
          'country': 'IN',
          'session_token': sessionToken,
          'access_token': accessToken,
        },
      );
      debugPrint('[MapboxSearchbox] suggest status=${response.statusCode}');
      debugPrint('[MapboxSearchbox] suggest response=${response.data}');

      if (response.statusCode != 200) {
        throw Exception(
          'Mapbox Searchbox suggest failed with status ${response.statusCode}.',
        );
      }

      final data = response.data;
      if (data is! Map<String, dynamic>) return const [];
      final suggestions = (data['suggestions'] as List?) ?? const [];
      if (suggestions.isEmpty) return const [];

      final results = await Future.wait(
        suggestions.whereType<Map<String, dynamic>>().map((suggestion) async {
          final mapboxId = _asTrimmedString(suggestion['mapbox_id']);
          if (mapboxId.isEmpty) return null;
          return _retrieveSearchboxSuggestion(
            mapboxId: mapboxId,
            fallbackCategory: category,
            accessToken: accessToken,
            sessionToken: sessionToken,
          );
        }),
      );

      return results
          .whereType<MapboxPlaceModel>()
          .where((place) => place.name.isNotEmpty)
          .toList(growable: false);
    } on DioException catch (e) {
      final message = e.response?.data is Map
          ? ((e.response?.data['message'] ?? '') as String)
          : (e.message ?? 'Unknown network error');
      throw Exception('Mapbox Searchbox API error: $message');
    } catch (e) {
      rethrow;
    }
  }

  Future<MapboxPlaceModel?> _retrieveSearchboxSuggestion({
    required String mapboxId,
    required String fallbackCategory,
    required String accessToken,
    required String sessionToken,
  }) async {
    final requestUri = Uri.parse('$_searchboxRetrieveBaseUrl/$mapboxId')
        .replace(
          queryParameters: <String, dynamic>{
            'session_token': sessionToken,
            'access_token': accessToken,
          },
        );
    debugPrint('[MapboxSearchbox] retrieve request=$requestUri');

    final response = await _dio.get(
      '$_searchboxRetrieveBaseUrl/$mapboxId',
      queryParameters: <String, dynamic>{
        'session_token': sessionToken,
        'access_token': accessToken,
      },
    );
    debugPrint('[MapboxSearchbox] retrieve status=${response.statusCode}');
    debugPrint('[MapboxSearchbox] retrieve response=${response.data}');
    if (response.statusCode != 200) return null;

    final data = response.data;
    if (data is! Map<String, dynamic>) return null;
    final features = (data['features'] as List?) ?? const [];
    if (features.isEmpty) return null;
    final feature = features.first;
    if (feature is! Map<String, dynamic>) return null;

    final geometry = feature['geometry'] as Map<String, dynamic>?;
    final coordinates = (geometry?['coordinates'] as List?) ?? const [];
    final lon = coordinates.isNotEmpty ? _toDouble(coordinates[0]) ?? 0.0 : 0.0;
    final lat = coordinates.length > 1 ? _toDouble(coordinates[1]) ?? 0.0 : 0.0;
    if (lat == 0.0 && lon == 0.0) return null;

    final properties = feature['properties'] as Map<String, dynamic>?;
    final name = _asTrimmedString(
      properties?['name'] ?? feature['text'] ?? feature['name'],
    );
    final address = _asTrimmedString(
      properties?['full_address'] ??
          properties?['place_formatted'] ??
          feature['place_name'],
    );

    return MapboxPlaceModel(
      name: name,
      address: address,
      latitude: lat,
      longitude: lon,
      category: fallbackCategory,
    );
  }

  List<MapboxPlaceModel> _mergeUniquePlaces(List<MapboxPlaceModel> places) {
    final unique = <String, MapboxPlaceModel>{};
    for (final place in places) {
      final key =
          '${place.name.toLowerCase()}_${place.latitude}_${place.longitude}';
      unique[key] = place;
    }
    return unique.values.toList(growable: false);
  }

  Future<String> reverseGeocodeAddress({
    required double latitude,
    required double longitude,
    String? accessToken,
  }) async {
    final token = (accessToken ?? EnvService.mapboxAccessToken).trim();
    if (token.isEmpty) {
      throw Exception('Mapbox access token is missing.');
    }

    try {
      final requestUri = Uri.parse('$_baseUrl/$longitude,$latitude.json')
          .replace(
            queryParameters: <String, dynamic>{
              'limit': '1',
              'access_token': token,
            },
          );
      debugPrint('[MapboxSearch] reverseGeocode request=$requestUri');
      final response = await _dio.get(
        '$_baseUrl/$longitude,$latitude.json',
        queryParameters: <String, dynamic>{'limit': 1, 'access_token': token},
      );
      debugPrint('[MapboxSearch] reverseGeocode status=${response.statusCode}');
      debugPrint('[MapboxSearch] reverseGeocode response=${response.data}');
      if (response.statusCode != 200) {
        throw Exception(
          'Mapbox reverse geocoding failed with status ${response.statusCode}.',
        );
      }
      final data = response.data;
      if (data is! Map<String, dynamic>) return '';
      final features = (data['features'] as List?) ?? const [];
      if (features.isEmpty) return '';
      final first = features.first;
      if (first is! Map<String, dynamic>) return '';
      return ((first['place_name'] ?? '') as String).trim();
    } on DioException catch (e) {
      final message = e.response?.data is Map
          ? ((e.response?.data['message'] ?? '') as String)
          : (e.message ?? 'Unknown network error');
      throw Exception('Mapbox reverse geocode error: $message');
    }
  }
}
