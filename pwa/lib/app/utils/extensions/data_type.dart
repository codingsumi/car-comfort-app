part of 'extension.dart';

extension $KotlinStyleExtension<T> on T {
  @pragma("vm:prefer-inline")
  T let(void Function(T it) func) {
    func(this);
    return this;
  }

  @pragma("vm:prefer-inline")
  T apply(void Function() func) {
    func();
    return this;
  }

  @pragma("vm:prefer-inline")
  R also<R>(R Function(T it) func) {
    return func(this);
  }

  @pragma("vm:prefer-inline")
  R run<R>(R Function() func) {
    return func();
  }
}

extension $ListExtension<T> on List<T> {
  T? get firstOrNull {
    return isEmpty ? null : first;
  }
}

extension $NullableListExtension<T> on List<T>? {
  bool get isNullOrEmpty => this == null || this!.isEmpty;

  bool get isNullOrNotEmpty => this != null && this!.isNotEmpty;
}

T enumFromString<T>(String key, List<T> values) => values.firstWhere((v) => key == enumToString(v));

String enumToString<T>(T value) => value.toString().split('.').last;

extension IndexedIterable<E> on Iterable<E> {
  Iterable<T> mapIndexed<T>(T Function(E element, int index) f) {
    var i = 0;
    return map((e) => f(e, i++));
  }

  void forEachIndexed(void Function(E element, int index) f) {
    var i = 0;
    forEach((e) => f(e, i++));
  }
}
