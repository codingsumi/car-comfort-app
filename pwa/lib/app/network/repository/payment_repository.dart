import '../../network/response/common_response.dart';
import '../utils/network_result.dart';
import 'base_repository.dart';
import 'endpoint.dart';

class PaymentRepository extends BaseRepository {
  Future<NetworkResult<CommonResponse>> createSetupIntent({
    required String category,
  }) {
    return post<CommonResponse>(
      API.createSetupIntent,
      body: {'category': category.trim().toLowerCase()},
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> addCard({
    required String paymentMethodId,
  }) {
    final body = {"payment_method_id": paymentMethodId.trim()};
    return post<CommonResponse>(
      API.addCard,
      body: body,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> listCards() {
    return get<CommonResponse>(
      API.listCards,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> setDefaultCard({
    required String paymentMethodId,
  }) {
    final body = {"payment_method_id": paymentMethodId.trim()};
    return post<CommonResponse>(
      API.setDefaultCard,
      body: body,
      fromJson: CommonResponse.fromJson,
    );
  }

  Future<NetworkResult<CommonResponse>> removeCard({
    required String paymentMethodId,
  }) {
    return delete<CommonResponse>(
      "${API.removeCard}/$paymentMethodId",
      body: const {},
      fromJson: CommonResponse.fromJson,
    );
  }
}
