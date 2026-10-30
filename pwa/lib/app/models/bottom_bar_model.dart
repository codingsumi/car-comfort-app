import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class NavBarItem {
  String title, activeIcon, icon;
  int navKey;
  Widget root;

  NavBarItem(this.title, this.icon, this.activeIcon, this.navKey, this.root);
}
