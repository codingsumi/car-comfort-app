import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';

/// Typography for CMS legal HTML (`description_json.html` or `content`).
Map<String, Style> legalHtmlStyles({
  Color bodyColor = const Color(0xff323232),
  Color linkColor = const Color(0xffE70B1C),
}) {
  return {
    'body': Style(
      margin: Margins.zero,
      padding: HtmlPaddings.zero,
      fontSize: FontSize(13),
      color: bodyColor,
    ),
    'article': Style(
      margin: Margins.zero,
      padding: HtmlPaddings.zero,
    ),
    'p': Style(
      margin: Margins.only(bottom: 10),
      fontSize: FontSize(13),
      lineHeight: LineHeight.number(1.45),
      color: bodyColor,
    ),
    'h1': Style(
      fontSize: FontSize(18),
      fontWeight: FontWeight.w700,
      color: bodyColor,
      margin: Margins.only(bottom: 12, top: 4),
    ),
    'h2': Style(
      fontSize: FontSize(16),
      fontWeight: FontWeight.w700,
      color: bodyColor,
      margin: Margins.only(bottom: 10, top: 16),
    ),
    'h3': Style(
      fontSize: FontSize(15),
      fontWeight: FontWeight.w600,
      color: bodyColor,
      margin: Margins.only(bottom: 8, top: 12),
    ),
    'ul': Style(
      margin: Margins.only(bottom: 10),
      padding: HtmlPaddings.only(left: 18),
    ),
    'li': Style(
      fontSize: FontSize(13),
      lineHeight: LineHeight.number(1.45),
      color: bodyColor,
    ),
    'a': Style(
      color: linkColor,
    ),
  };
}
