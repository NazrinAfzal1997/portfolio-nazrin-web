/*
  Shopee affiliate products for nazrin-afzal.my/shopping/shopee

  One entry per product:
    code      number shown in your video (searchable: "12", "#12", "012" all work)
    name      product name (searchable)
    category  short tag, e.g. "Beauty", "Home"; becomes a filter tab automatically
    tags      optional extra tabs, e.g. tags: ["Baby"]; the product also shows under the "Baby" tab
              and when someone searches "baby" (its main category stays the same)
    image     one photo: image URL, or a file path like "img/012.webp" (leave "" for a placeholder)
    images    several photos (shows < > arrows + swipe), e.g. images: ["img/012-1.webp", "img/012-2.webp"]
              use either image or images, not both
    link      your Shopee affiliate link
    price     optional price in RM, e.g. price: 12.90 (shown on the card, enables "Price" sorting)
    hot       optional, hot: true marks a hot item (HOT badge + "Hot only" filter)
    keywords  optional extra search words (other names, Malay words, brand), e.g. "botol air"

  NOTE: the entries below are PLACEHOLDERS. Replace them with your real products.
*/
window.PRODUCTS = [
  { code: 1,  name: "Cushion Foundation Natural Glow",  category: "Beauty",  price: 39.90, hot: true, image: "", link: "#", keywords: "bedak makeup" },
  { code: 2,  name: "Non-stick Frying Pan 28cm",        category: "Kitchen", price: 59, image: "", link: "#", keywords: "kuali" },
  { code: 3,  name: "Cotton Telekung Travel Set",       category: "Fashion", price: 79, image: "", link: "#", keywords: "telekung solat" },
  { code: 4,  name: "Fast Charging Cable Type-C",       category: "Gadget",  price: 9.90, hot: true, image: "", link: "#", keywords: "charger usb" },
  { code: 5,  name: "Aloe Vera Soothing Gel",           category: "Beauty",  tags: ["Baby"], price: 14.50, image: "", link: "#", keywords: "skincare" },
  { code: 6,  name: "Airtight Rice Storage Box 10kg",   category: "Kitchen", tags: ["Baby"], price: 34.90, image: "", link: "#", keywords: "bekas beras" },
  { code: 7,  name: "Chiffon Shawl Premium",            category: "Fashion", price: 25, image: "", link: "#", keywords: "tudung shawl" },
  { code: 9,  name: "Smart LED Desk Lamp",              category: "Gadget",  price: 49.90, image: "", link: "#", keywords: "lampu meja" }
];
