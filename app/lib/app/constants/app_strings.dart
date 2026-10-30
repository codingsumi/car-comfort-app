class AppStrings {
  // ============================================================================
  // VALIDATION MESSAGES
  // ============================================================================
  
  // Form Validation
  static const String requiredField = 'This field is required.';
  static const String invalidInput = 'Invalid input.';
  static const String invalidEmail = 'Please enter a valid email address.';
  static const String invalidPhoneNumber = 'Please enter a valid phone number.';
  static const String invalidPostalCode = 'Invalid postal code format.';
  static const String passwordMismatch = 'Passwords do not match.';
  static const String passwordValidation = 'Please include a capital letter, number, and symbol in your password.';
  
  // Product Validation
  static const String enterItemName = 'Please enter an item name.';
  static const String uploadAtLeastOneImage = 'Please upload at least one image.';
  static const String maxImagesLimit = 'Please note: only up to 10 images can be uploaded.';
  static const String selectCategory = 'Please select a category.';
  static const String enterBrand = 'Please enter a brand.';
  static const String enterDescription = 'Please enter a description.';
  static const String enterItemWeight = 'Please enter the item weight.';
  static const String enterItemLength = 'Please enter the item length.';
  static const String enterItemWidth = 'Please enter the item width.';
  static const String enterItemHeight = 'Please enter the item height.';
  static const String selectWeightUnit = 'Please select the item\'s weight unit.';
  static const String selectDimensionUnit = 'Please select the item dimension unit.';
  static const String selectPackageSize = 'Please select the item package size.';
  static const String selectAtLeastOneColor = 'Please select at least one color.';
  static const String selectSizeType = 'Please select a size type.';
  static const String selectSize = 'Please select a size.';
  static const String selectBrand = 'Please select a brand.';
  static const String selectCondition = 'Please select the condition.';
  static const String enterPrice = 'Please enter a price.';
  static const String priceGreaterThanZero = 'Item price must be greater than 0.';
  static const String priceNoDecimalEnd = 'Item price cannot end with a decimal point.';
  static const String reduceDimensions = 'Please reduce dimensions. Volume exceeds 100L.';
  static const String weightLimitExceeded = 'Item weight should be up to {weight}.';
  static const String packageSizeLimit = 'This package size supports up to {maxAllowed}g only. Current weight: {currentWeight}g.';
  
  // Authentication Validation
  static const String uploadProfilePicture = 'Please upload a profile picture.';
  static const String enterFirstName = 'Please enter your first name.';
  static const String enterLastName = 'Please enter your last name.';
  static const String enterDateOfBirth = 'Please enter your date of birth.';
  static const String enterPassword = 'Please enter a password.';
  static const String enterUsername = 'Please enter a username first.';
  static const String usernameMinLength = 'Username must be at least 4 characters long.';
  static const String enterReason = 'Please enter a reason.';
  static const String enterAtLeastFourDigits = 'Please enter at least 4 digits.';
  static const String choosePasswordRecoveryMode = 'Please choose the password recovery mode.';
  static const String enterCodeSentTo = 'Please enter the code sent to your {contactType}.';
  
  // Order Validation
  static const String selectPickupInstructions = 'Please select pickup instructions.';
  static const String enterPickupInstructions = 'Please enter pickup instructions.';
  static const String selectAddress = 'Please select an address.';
  static const String selectOrder = 'Please select an order.';
  static const String selectIssue = 'Please select an issue.';
  static const String selectSolution = 'Please select a solution.';
  static const String enterOtherResolution = 'Please enter the other resolution.';
  static const String provideDetails = 'Please provide details.';
  static const String selectRating = 'Please select a rating.';
  static const String selectAtLeastOneFilter = 'Please select at least one filter.';
  static const String enterAmount = 'Please enter an amount.';
  static const String selectAccount = 'Please select an account.';
  
  // Offer Validation
  static const String offerAmountGreaterThanZero = 'Offer amount must be greater than 0.';
  static const String offerPriceNotGreaterThanItem = 'Your offer price cannot be greater than the item price.';
  static const String invalidOffer = 'Invalid offer entered.';
  
  // ============================================================================
  // SUCCESS MESSAGES
  // ============================================================================
  
  // Authentication
  static const String otpSentSuccessfully = 'OTP sent successfully.';
  static const String requestSentSuccessfully = 'Request sent successfully.';
  static const String passwordChangedSuccessfully = 'Password changed successfully.';
  static const String changesSavedSuccessfully = 'Changes saved successfully.';
  
  // Product Management
  static const String productMarkedAsSold = 'Product marked as sold.';
  static const String offerSentSuccessfully = 'Offer sent successfully.';
  static const String productReportedSuccessfully = 'Product reported successfully.';
  static const String userReportedSuccessfully = 'User reported successfully.';
  
  // Orders
  static const String orderCancelledSuccessfully = 'Order cancelled successfully.';
  static const String orderRescheduledSuccessfully = 'Order rescheduled successfully.';
  static const String ausPostTrackingAdded = 'Aus Post tracking URL added successfully.';
  static const String bagRequestedSuccessfully = 'Bag has been requested successfully.';
  
  // Settings
  static const String addressAddedSuccessfully = 'Address added successfully.';
  static const String addressUpdatedSuccessfully = 'Address updated successfully.';
  static const String cardAddedSuccessfully = 'Card added successfully.';
  static const String cardUpdatedSuccessfully = 'Card updated successfully.';
  static const String cardDeletedSuccessfully = 'Card deleted successfully.';
  static const String userBlockedSuccessfully = 'User blocked successfully.';
  
  // Disputes
  static const String disputeCreatedSuccessfully = 'Dispute created successfully.';
  static const String noDeliveredOrdersForDispute = 'You have no delivered orders to create a dispute.';
  static const String addEvidenceMedia = 'Please add evidence media.';
  
  // ============================================================================
  // ERROR MESSAGES
  // ============================================================================
  
  // Network Errors
  static const String networkError = 'A network error occurred. Please check your internet connection.';
  static const String timeoutError = 'The request timed out. Please try again.';
  static const String serverError = 'A server error occurred. Please try again later.';
  
  // Authentication Errors
  static const String invalidCredentials = 'Invalid email or password.';
  static const String emailAlreadyExists = 'This email already exists.';
  static const String sessionExpired = 'Your session has expired. Please log in again.';
  static const String sessionInvalidatedOtherDevice =
      'Your account was signed in on another device. You have been logged out of this device.';
  
  // File Upload Errors
  static const String fileTooLarge = 'File size exceeds the maximum limit.';
  static const String invalidFileType = 'Invalid file type.';
  static const String uploadFailed = 'File upload failed. Please try again.';
  static const String onlyImageFilesAllowed = 'Only image files are allowed.';
  static const String onlyFirstTenImagesUsed = 'Only the first 10 images will be used.';
  static const String failedToPrepareImage = 'Failed to prepare image for sharing.';
  
  // Payment Errors
  static const String paymentFailed = 'Payment was unsuccessful. Please try again.';
  static const String insufficientFunds = 'Insufficient funds.';
  static const String invalidCard = 'Invalid card details.';
  static const String cardExpired = 'This card has expired.';
  static const String incorrectDetails = 'Incorrect details. Please try again.';
  
  // General Errors
  static const String unknownError = 'An unknown error occurred.';
  static const String tryAgainLater = 'Please try again later.';
  static const String operationFailed = 'Operation failed. Please try again.';
  static const String errorOccurredWhileLaunching = 'Sorry, an error occurred while launching.';
  static const String orderCannotBeTracked = 'Order cannot be tracked.';
  static const String orderTrackingUrlIncorrect = 'The order cannot be tracked because the provided URL seems to be incorrect.';
  
  // ============================================================================
  // INFORMATION MESSAGES
  // ============================================================================
  
  // System Messages
  static const String downloading = 'Downloading...';
  static const String soldItemMessage = 'You\'ve sold an item to {buyerName}. Please ship this item within three days.';
  
  // Sendle Messages
  static const String sendleUnavailable = 'Please note: Sendle is unavailable in your area. Please use Australia Post during checkout.';
  static const String sendleCollectionUnavailable = 'Please note: Sendle is unavailable in your area.';
  
  // ============================================================================
  // ALERT MESSAGES
  // ============================================================================
  
  // Permission Messages
  static const String permissionDenied = 'Permission is denied.';
  static const String permissionAlreadyGranted = 'Permission is already granted.';
  static const String permissionPermanentlyDenied = 'Permission is permanently denied.';
  static const String permissionOSRestricted = 'Permission is OS restricted.';
  
  // ============================================================================
  // UI LABELS & TITLES
  // ============================================================================
  
  // App Title
  static const String appTitle = 'RECO';
  
  // Navigation & Headers
  static const String settings = 'Settings';
  static const String profile = 'Profile';
  static const String shippingAddress = 'Shipping Address';
  static const String sendleCollectionAddress = 'Sendle Collection Address';
  static const String shippingMethods = 'Shipping Methods';
  static const String wallet = 'Wallet';
  static const String paymentMethods = 'Payment Methods';
  static const String notificationSettings = 'Notification Settings';
  static const String alerts = 'Alerts';
  static const String blockedUsers = 'Blocked Users';
  static const String disputeCentre = 'Dispute Centre';
  static const String support = 'Support';
  static const String faq = 'F.A.Q.';
  static const String deleteAccount = 'Delete account';
  static const String changePassword = 'Change Password';
  static const String language = 'Language';
  static const String newProductAlerts = 'New Product Alerts';
  static const String withdrawFunds = 'Withdraw Funds';
  static const String myWallet = 'My Wallet';
  static const String myOrders = 'My Orders';
  static const String pickUp = 'Pick Up';
  static const String dropOff = 'Drop Off';
  static const String shippingLabel = 'Shipping Label';
  static const String refund = 'Refund';
  static const String refundAndReturn = 'Refund & Return';
  static const String reviews = 'Reviews';
  static const String saves = 'Saves';
  static const String sell = 'Sell';
  static const String editItem = 'Edit Item';
  static const String payment = 'Payment';
  static const String inbox = 'Inbox';

  // Form Labels
  static const String firstName = 'First Name';
  static const String lastName = 'Last Name';
  static const String username = 'Username';
  static const String pleaseChooseUsername = "Please choose a username";
  static const String email = 'Email';
  static const String password = 'Password';
  static const String currentPassword = 'Current Password';
  static const String newPassword = 'New Password';
  static const String repeatPassword = 'Repeat Password';
  static const String repeatTheNewPassword =  "Repeat the new password";
  static const String chooseNewPassword =  "Choose a New Password";
  static const String enterNewPassword =  "Enter a new password";
  static const String passwordRecovery = "Password Recovery";
  static const String bio = 'Bio';
  static const String dateOfBirth = 'Date of Birth';
  static const String phoneNumber = 'Phone Number';
  static const String address = 'Address';
  static const String townCity = 'Town / City';
  static const String postcode = 'Postcode';
  static const String country = 'Country';
  static const String selectCountry = 'Select your country';
  static const String state = 'State';
  static const String reason = 'Reason';
  static const String reasonForDeletion = 'Reason for deletion';
  static const String description = 'Description';
  static const String title = 'Title';
  static const String orderNumber = 'Order Number';
  static const String issue = 'Issue';
  static const String proposedSolution = 'Proposed Solution';
  static const String message = 'Message';
  static const String search = 'Search';
  static const String filter = 'Filter';
  static const String sortBy = 'Sort by';
  static const String seeAll = 'See All';
  static const String name = 'Name';
  static const String amount = 'Amount';
  static const String cardName = 'Card Name';
  static const String cardNumber = 'Card Number';
  static const String expiryDate = 'Expiry Date';
  static const String cvv = 'CVV';
  static const String inviteCode = 'Invite Code';
  static const String code = 'Code';
  static const String itemName = 'Item Name';
  static const String itemWeight = 'Item Weight';
  static const String length = 'Length';
  static const String width = 'Width';
  static const String height = 'Height';
  static const String price = 'Price';
  static const String brand = 'Brand';
  static const String colour = 'Colour';
  static const String size = 'Size';
  static const String productInfo = 'Product Info';
  static const String counterPrice = 'Counter Price';
  static const String offerPrice = 'Offer Price';
  static const String pickupInstructions = 'Pickup Instructions';
  static const String deliveryInstructions = 'Delivery Instructions';
  static const String evidenceMedia = 'Evidence Media';
  
  // Button Labels
  static const String submit = 'Submit';
  static const String save = 'Save';
  static const String saveChanges = 'Save Changes';
  static const String edit = 'Edit';
  static const String delete = 'Delete';
  static const String cancel = 'Cancel';
  static const String continue_ = 'Continue';
  static const String next = 'Next';
  static const String back = 'Back';
  static const String add = 'Add';
  static const String addCard = 'Add Card';
  static const String addAlert = 'Add Alert';
  static const String createAlert = 'Create an Alert';
  static const String createDispute = 'Create Dispute';
  static const String signUp = 'Sign Up';
  static const String login = 'Login';
  static const String loginWithAnotherAccount="Login with another account";
  static const String getStarted = 'Get Started';
  static const String refresh = 'Refresh';
  static const String returnHome = 'Return Home';
  static const String deleteItem = 'Delete Item';
  static const String markAsSold = 'Mark as Sold';
  static const String makeOffer = 'Make an offer';
  static const String buyNow = 'Buy now';
  static const String sizeChart = 'Size Chart';
  static const String clear = 'Clear';
  static const String apply = 'Apply';
  static const String pay = 'Pay';
  static const String transfer = 'Transfer';
  static const String verifyIdentity = 'Verify Identity';
  static const String withdraw = 'Withdraw';
  static const String confirmDetails = 'Confirm Details';
  static const String rebookShipment = 'Rebook Shipment';
  static const String cancelOrder = 'Cancel Order';
  static const String requestBag = 'Request Bag';
  static const String takeAction = 'Take Action';
  static const String camera = 'Camera';
  static const String gallery = 'Gallery';
  static const String picture = 'Picture';
  static const String video = 'Video';
  
  // ============================================================================
  // HINT TEXTS
  // ============================================================================
  
  // Form Hints
  static const String hintFirstName = 'First Name';
  static const String hintLastName = 'Last Name';
  static const String hintUsername = 'Username';
  static const String enterName = 'Enter Name';
  static const String hintEmail = 'Email';
  static const String hintPassword = 'Password';
  static const String hintCurrentPassword = 'Enter your current password';
  static const String hintNewPassword = 'New Password';
  static const String hintRepeatPassword = 'Repeat Password';
  static const String hintBio = 'Bio';
  static const String hintDateOfBirth = 'Date of Birth';
  static const String hintPhoneNumber = 'Phone Number';
  static const String hintAddress = 'Enter Address';
  static const String hintTownCity = 'Enter Town / City';
  static const String hintPostcode = 'Enter Postcode';
  static const String hintReason = 'Reason';
  static const String hintReasonForDeletion = 'Type your reason here..';
  static const String hintDescription = 'Enter description';
  static const String hintTitle = 'Title';
  static const String hintOrderNumber = 'Order Number';
  static const String hintIssue = 'Issue';
  static const String hintProposedSolution = 'Proposed Solution';
  static const String hintMessage = 'Message';
  static const String hintSearch = 'Search';
  static const String hintFilter = 'Filter';
  static const String hintName = 'Name';
  static const String hintAmount = '00';
  static const String hintCardName = 'Enter Card Name';
  static const String hintCardNumber = 'Enter Card Number';
  static const String hintExpiryDate = 'Enter Expiry Date';
  static const String hintCvv = 'Enter CVV';
  static const String hintInviteCode = 'Enter Invite Code';
  static const String hintCode = 'Code';
  static const String hintItemName = 'Item Name';
  static const String hintItemWeight = 'Enter item weight';
  static const String hintLength = 'Length';
  static const String hintWidth = 'Width';
  static const String hintHeight = 'Height';
  static const String hintPrice = 'Enter Price';
  static const String hintBrand = 'Type or Select Brand';
  static const String hintEnterBrand = 'Enter Brand';
  static const String hintOfferPrice = 'Enter offer price';
  static const String hintCounterPrice = 'Counter Price';
  static const String hintPickupInstructions = 'Select pickup instructions';
  static const String hintEnterPickupInstructions = 'Enter pickup instructions';
  static const String hintDeliveryInstructions = 'Enter delivery instructions';
  static const String hintEvidenceMedia = 'Please add evidence media';
  static const String hintIssueDetails = 'Enter issue details';
  static const String hintSolutionDetails = 'Enter solution details';
  static const String hintOtherResolution = 'Enter other resolution';
  static const String hintDisputeDetails = 'Please provide details of why you are raising a dispute, and anything else that may be relevant.';
  static const String hintResponseDetails = 'Please provide details of your response and anything else that may be relevant.';
  static const String hintFinalStatement = 'Please provide a final statement describing why you would like to escalate this dispute...';
  static const String hintSupportIssue = 'Please describe your issue..';
  static const String hintDeleteAccountDetails = 'Please provide details of why you wish to delete your account and anything else that may be relevant.';
  
  // ============================================================================
  // ALERT DIALOG TITLES & CONTENT
  // ============================================================================
  
  // Alert Titles
  static const String alertTitleError = 'Error';
  static const String alertTitleSuccess = 'Success';
  static const String alertTitleAlert = 'Alert';
  static const String alertTitleDeleteAlert = 'Delete Alert';
  static const String alertTitleDeleteCard = 'Delete Card';
  static const String alertTitleCancelOrder = 'Cancel Order';
  static const String alertTitleConfirmWithdraw = 'Confirm Withdraw';
  static const String alertTitlePermissionsDenied = 'Permissions Denied';
  static const String alertTitleUploaded = 'Uploaded';
  static const String alertTitleRequestSubmitted = 'Request Submitted';
  static const String alertTitleSupportCreated = 'Support Created';
  static const String alertTitleWhatAction = 'What action would you like to take?';
  static const String alertTitleResolveDispute = 'Are you sure you would like to resolve this dispute?';
  static const String alertTitleConfirmDeleteAccount = 'Please confirm you wish to delete your account';
  static const String alertTitleParcelCollection = 'Would you like to have your parcel collected or drop it off?';
  static const String alertTitleProductUploaded = 'Product uploaded successfully!';
  
  // Alert Content
  static const String alertContentDeleteAlert = 'Are you sure you want to delete this alert?';
  static const String alertContentDeleteCard = 'Are you sure you want to delete this card?';
  static const String alertContentCancelOrder = 'Are you sure you want to cancel this order?';
  static const String alertContentConfirmWithdraw = 'Are you sure you want to withdraw this amount?';
  static const String alertContentPermissionsDenied = 'Camera and storage permissions are required to use this feature.';
  static const String alertContentSupportCreated = 'Please allow 72 hours for your support to be reviewed';
  static const String alertContentKeepShopping = 'Keep Shopping';

  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  /// Replace placeholders in strings with actual values
  static String format(String template, Map<String, dynamic> values) {
    String result = template;
    values.forEach((key, value) {
      result = result.replaceAll('{$key}', value.toString());
    });
    return result;
  }
  
  /// Get weight limit exceeded message with actual weight
  static String getWeightLimitMessage(String weight) {
    return format(weightLimitExceeded, {'weight': weight});
  }
  
  /// Get package size limit message with actual values
  static String getPackageSizeMessage(num maxAllowed, num currentWeight) {
    return format(packageSizeLimit, {
      'maxAllowed': maxAllowed,
      'currentWeight': currentWeight.toStringAsFixed(1)
    });
  }
  
  /// Get sold item message with buyer name
  static String getSoldItemMessage(String buyerName) {
    return 'You\'ve sold an item to $buyerName. Please ship this item within three days.';
  }
  
  /// Get dispute status message
  static String getDisputeStatusMessage(String status) {
    return 'Dispute marked as $status.';
  }
  
  /// Get code sent message with contact type
  static String getCodeSentMessage(String contactType) {
    return "Please enter the code sent to your $contactType.";
  }
}
