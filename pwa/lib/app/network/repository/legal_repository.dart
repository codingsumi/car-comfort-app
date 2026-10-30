import '../response/legal_page_response.dart';
import '../utils/network_result.dart';
import 'base_repository.dart';
import 'endpoint.dart';

class LegalRepository extends BaseRepository {
  Future<NetworkResult<LegalPagesListApiResponse>> getLegalPages({
    LegalAudience audience = LegalAudience.customer,
  }) {
    return get<LegalPagesListApiResponse>(
      API.legalPages,
      query: {'audience': audience.value},
      fromJson: LegalPagesListApiResponse.fromJson,
    );
  }

  Future<NetworkResult<LegalPageApiResponse>> getLegalPage({
    required String page,
    LegalAudience audience = LegalAudience.customer,
  }) {
    return get<LegalPageApiResponse>(
      API.legalPage,
      query: {
        'page': page,
        'audience': audience.value,
      },
      fromJson: LegalPageApiResponse.fromJson,
    );
  }
}
