import '../../models/service_model.dart';
import '../utils/network_result.dart';
import 'base_repository.dart';
import 'endpoint.dart';

class ServiceRepository extends BaseRepository {
  Future<NetworkResult<List<ServiceModel>>> getServices() async {
    return await get<List<ServiceModel>>(
      API.services,
      fromJson: (json) {
        if (json is Map && json['data'] != null) {
          return (json['data'] as List)
              .map((e) => ServiceModel.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList();
        } else if (json is List) {
          return json
              .map((e) => ServiceModel.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList();
        }
        return [];
      },
    );
  }
}
