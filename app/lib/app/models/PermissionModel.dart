import 'package:permission_handler/permission_handler.dart';

class PermissionModel {
  final String title;
  final String description;
  final bool isGranted;
  final String icon;
  final String slug;

  const PermissionModel(this.title, this.description, this.isGranted, this.icon, this.slug);
}

class PermModel {
  final Permission permission;
  PermissionStatus status;

  PermModel(this.permission, {this.status = PermissionStatus.denied});
}
