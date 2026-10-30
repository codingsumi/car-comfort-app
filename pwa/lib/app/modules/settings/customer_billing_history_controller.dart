import 'dart:async';

import 'package:get/get.dart';

import '../../network/repository/dash_repository.dart';
import '../../network/repository/driver_payment_history_response.dart' as dph;
import '../../utils/app_snackbar.dart';

class CustomerBillingHistoryController extends GetxController {
  final DashRepository _dashRepository = DashRepository();

  static const int _pageLimit = 10;

  final RxList<dph.Transactions> transactions = <dph.Transactions>[].obs;
  final RxBool completedSelected = true.obs;
  final RxBool isLoading = false.obs;
  final RxBool isLoadingMore = false.obs;
  final RxBool isRefreshing = false.obs;
  final RxBool hasMore = true.obs;

  int _lastLoadedPage = 0;
  int? _totalPages;
  bool _refreshQueued = false;

  String get statusFilter =>
      completedSelected.value ? 'completed' : 'pending';

  @override
  void onInit() {
    super.onInit();
    fetchTransactions();
  }

  void selectCompletedTab() {
    if (completedSelected.value) return;
    completedSelected.value = true;
    fetchTransactions(refresh: true);
  }

  void selectPendingTab() {
    if (!completedSelected.value) return;
    completedSelected.value = false;
    fetchTransactions(refresh: true);
  }

  Future<void> refreshTransactions() => fetchTransactions(refresh: true);

  Future<void> loadMoreTransactions() => fetchTransactions(refresh: false);

  Future<void> fetchTransactions({bool refresh = false}) async {
    if (refresh) {
      if (isLoading.value || isLoadingMore.value) {
        _refreshQueued = true;
        return;
      }
      isRefreshing.value = true;
      _lastLoadedPage = 0;
      _totalPages = null;
      hasMore.value = true;
    }

    if (!hasMore.value && !refresh) return;

    final nextPage = _lastLoadedPage == 0 ? 1 : _lastLoadedPage + 1;

    if (_totalPages != null && nextPage > _totalPages!) {
      hasMore.value = false;
      if (refresh) isRefreshing.value = false;
      return;
    }

    final isFirstChunk = nextPage == 1;

    if (isFirstChunk) {
      if (isLoading.value) {
        if (refresh) {
          _refreshQueued = true;
          isRefreshing.value = false;
        }
        return;
      }
      isLoading.value = true;
    } else {
      if (isLoadingMore.value || isLoading.value || !hasMore.value) return;
      isLoadingMore.value = true;
    }

    try {
      final res = await _dashRepository.getCustomerBillingHistory(
        page: nextPage,
        limit: _pageLimit,
        status: statusFilter,
      );
      res.when(
        success: (data) {
          final pagination = data.data?.pagination;
          if (pagination?.totalPages != null) {
            _totalPages = pagination!.totalPages;
          }

          final raw = data.data?.transactions ?? const <dph.Transactions>[];
          if (isFirstChunk) {
            transactions.assignAll(raw);
          } else {
            transactions.addAll(raw);
          }

          _lastLoadedPage = pagination?.page ?? nextPage;
          final limit = pagination?.limit ?? _pageLimit;

          if (pagination?.totalPages != null) {
            hasMore.value = _lastLoadedPage < pagination!.totalPages!;
          } else {
            hasMore.value = raw.length >= limit;
          }
        },
        error: (err) {
          showAppSnackBar(
            title: 'Billing History',
            message: err.message,
            isError: true,
          );
        },
      );
    } finally {
      isLoading.value = false;
      isLoadingMore.value = false;
      if (refresh) isRefreshing.value = false;
      final runQueued = _refreshQueued;
      _refreshQueued = false;
      if (runQueued && !isClosed) {
        unawaited(fetchTransactions(refresh: true));
      }
    }
  }

  static String transactionTitle(dph.Transactions t) {
    final bookingCode = t.booking?.bookingCode?.trim();
    if (bookingCode != null && bookingCode.isNotEmpty) {
      return 'Booking $bookingCode';
    }
    final code = t.transactionCode?.trim();
    if (code != null && code.isNotEmpty) return 'Payment $code';
    return 'Payment';
  }

  static String formatAmount(double? amount, String? currency) {
    if (amount == null) return '—';
    final code = (currency ?? 'usd').trim().toLowerCase();
    final symbol = code == 'usd' ? '\$' : '';
    return '$symbol${amount.toStringAsFixed(2)}';
  }

  static String formatDateLabel(String? iso) {
    if (iso == null || iso.trim().isEmpty) return 'Date: —';
    final dt = DateTime.tryParse(iso);
    if (dt == null) return 'Date: $iso';
    final local = dt.toLocal();
    final mm = local.month.toString().padLeft(2, '0');
    final dd = local.day.toString().padLeft(2, '0');
    final yyyy = local.year.toString();
    return 'Date: $mm-$dd-$yyyy';
  }

  static String statusLabel(String? status) {
    final clean = status?.trim();
    if (clean == null || clean.isEmpty) return '—';
    return clean
        .replaceAll('_', ' ')
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1).toLowerCase()}')
        .join(' ');
  }

  static bool isConfirmedStatus(String? status) {
    final s = status?.trim().toLowerCase() ?? '';
    return s == 'completed' ||
        s == 'confirmed' ||
        s == 'success' ||
        s == 'paid' ||
        s == 'succeeded';
  }
}
