import 'network_exception.dart';

sealed class NetworkResult<T> {
  const NetworkResult();

  const factory NetworkResult.success(T data) = NetworkSuccess;

  const factory NetworkResult.error(NetworkException error) = NetworkError;

  void when({required Function(T success) success, required Function(NetworkException error) error}) {
    switch (this) {
      case NetworkSuccess<T> _:
        success((this as NetworkSuccess<T>).data);
      case NetworkError<T> _:
        error((this as NetworkError<T>).error);
    }
  }
}

class NetworkSuccess<T> extends NetworkResult<T> {
  final T data;

  const NetworkSuccess(this.data);
}

class NetworkError<T> extends NetworkResult<T> {
  final NetworkException error;

  const NetworkError(this.error);
}
