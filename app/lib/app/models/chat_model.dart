class ChatModel {
  final String senderId;
  final String senderName;
  final String senderImage;
  final String receiverId;
  final String receiverName;
  final String receiverImage;
  final String msg;
  final String type;
  final String timeStamp;
  final String pushKey;
  Offer? offer;
  Product? product;
  int? unReadCount;

  ChatModel({
    required this.senderId,
    required this.receiverId,
    required this.msg,
    required this.receiverName,
    required this.receiverImage,
    required this.senderName,
    required this.senderImage,
    required this.type,
    required this.timeStamp,
    required this.pushKey,
    this.offer,
    this.product,
    this.unReadCount,
  });

  @override
  String toString() {
    return 'Sender ID: $senderId\n'
        'Receiver ID: $receiverId\n'
        'Message: $msg\n'
        'Receiver Name: $receiverName\n'
        'Receiver Image: $receiverImage\n'
        'Sender Name: $senderName\n'
        'Sender Image: $senderImage\n'
        'Type: $type\n'
        'Timestamp: $timeStamp\n'
        'Push Key: $pushKey\n'
        'OFFER :${offer?.toJson()}\n'
        'Unread Count: $unReadCount';
  }
}

class Offer {
  String? type;
  String? price;
  bool? isAccepted;
  bool? isCounterOfferSend;

  Offer({
    this.type,
    this.price,
    this.isAccepted,
    this.isCounterOfferSend,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['type'] = type;
    map['price'] = price;
    map['isAccepted'] = isAccepted;
    map['isCounterOfferSend'] = isCounterOfferSend;
    return map;
  }

  Offer.fromJson(dynamic json) {
    type = json['type'];
    price = json['price'];
    isAccepted = json['isAccepted'];
    isCounterOfferSend = json['isCounterOfferSend'];
  }
}

class Product {
  String? id;
  String? name;
  String? sellerId;
  String? image;
  String? price;
  int? timestamp;
  bool? isArchived;

  Product({
    this.id,
    this.name,
    this.sellerId,
    this.image,
    this.price,
    this.timestamp,
    this.isArchived,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    map['id'] = id;
    map['name'] = name;
    map['sellerId'] = sellerId;
    map['image'] = image;
    map['price'] = price;
    map['timestamp'] = timestamp;
    map['isArchived'] = isArchived;
    return map;
  }

  Product.fromJson(dynamic json) {
    id = json['id'];
    name = json['name'];
    sellerId = json['sellerId'];
    image = json['image'];
    price = json['price'];
    timestamp = json['timestamp'];
    isArchived = json['isArchived'];
  }
}
