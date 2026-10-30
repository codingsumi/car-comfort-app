class DisputeMediaModel {
  String? urlPath;
  String? thumbnailPath;
  bool? isVideo;

  DisputeMediaModel(this.urlPath, {this.thumbnailPath, this.isVideo = false});

  @override
  String toString() {
    return 'URL PATH : $urlPath \n'
        'URL PATH : $thumbnailPath\n'
        'IS VIDEO : $isVideo\n';
  }
}
