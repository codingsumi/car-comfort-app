class ImageModel {
  String? urlPath;
  String? thumbnail;
  bool? isUrl;

  ImageModel({this.urlPath, this.isUrl = false, this.thumbnail = ""});

  @override
  String toString() {
    return 'URL PATH : $urlPath\n'
        'IS URL : $isUrl\n';
  }
}
