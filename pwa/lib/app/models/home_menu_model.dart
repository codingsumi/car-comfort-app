class MenuModel {
  final String title;
  String slug;

  MenuModel(this.title, this.slug);
}

class CategoryModel {
  final String title;
  String slug;
  String type;

  CategoryModel(this.title, this.slug, this.type);
}
