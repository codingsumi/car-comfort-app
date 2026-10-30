class DisputeConstants {
  static const String statusPendingReview = 'Pending Review';
  static const String statusUnderDiscussion = 'Under Review';
  static const String statusResolved = 'Resolved';
  static const String statusClosed = 'Closed';
  static const String statusAdminReview = 'Admin Review';
  static const String escalated = 'Escalated';

  static const List<String> issuesList = [
    "Item not received",
    "Item significantly different from description",
    "Item was damaged or faulty",
    "Item is counterfeit or inauthentic",
    "Item missing parts/accessories",
  ];

  static const List<String> proposedSolutionList = [
    "Full refund",
    "Return the item for a refund",
    "Partial refund",
    "Other (please provide details)",
  ];

  static const List<String> escalateReasonList = [
  "Seller didn’t respond",
  "Seller disagreed with dispute reason",
  "Seller refused refund or return",
  "Other (please provide details)",
  ];

  static const List<String> responseReasonList = [
  "Provide a full refund (once submitted this automatically initiates a full refund)",
  "Request buyer to return item for a full refund",
  "Provide a partial refund",
  "Other (please provide details)",
  ];

}
