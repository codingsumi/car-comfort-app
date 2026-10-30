

String maskPhoneNumber(String phoneNumber) {
  if (phoneNumber.length <= 5) {
    return phoneNumber;
  }
  String prefix = phoneNumber.substring(0, 3);
  String suffix = phoneNumber.substring(phoneNumber.length - 2);
  String maskedMiddle = '*' * (phoneNumber.length - 5);
  return prefix + maskedMiddle + suffix;
}

// void makePreCacheOfImages(List<ImageResponse?> images) {
//   try {
//     for (var e in images) {
//       if (e?.original != null) {
//         precacheImage(NetworkImage(e?.original ?? ""), Get.context!);
//       }
//     }
//   } catch (e) {
//     e.printError();
//   }
// }
