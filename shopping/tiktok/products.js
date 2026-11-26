/*
  TikTok affiliate products for nazrin-afzal.my/shopping/tiktok

  One entry per product:
    code      number shown in your TikTok video (searchable: "12", "#12", "012" all work)
    name      product name (searchable)
    category  short tag, e.g. "Beauty", "Home"; becomes a filter chip automatically
    tags      optional extra tabs, e.g. tags: ["Baby"]; the product also shows under the "Baby" tab
              and when someone searches "baby" (its main category stays the same)
    image     one photo: image URL, or a file path like "img/012.webp" (leave "" for a placeholder)
    images    several photos (shows < > arrows + swipe), e.g. images: ["img/012-1.webp", "img/012-2.webp"]
              use either image or images, not both
    link      your TikTok affiliate link
    price     optional, NOT shown on the page (prices change often); only used for the
              "Price" sort options, which appear once products have a price
    hot       optional, hot: true marks a hot item (HOT badge + "Hot only" filter)
    keywords  optional extra search words (other names, Malay words, brand), e.g. "botol air"

  NOTE: the entries below are PLACEHOLDERS. Replace them with your real products.
*/
window.PRODUCTS = [
  { code: 1,  name: "Velvet Matte Lip Tint",          category: "Beauty",  hot: true, image: "", link: "#", keywords: "lipstick gincu" },
  { code: 2,  name: "Stainless Steel Tumbler 900ml",  category: "Home",    tags: ["Baby"], image: "", link: "#", keywords: "botol air bottle" },
  { code: 3,  name: "Oversized Cotton Tee",           category: "Fashion", image: "", link: "#", keywords: "baju t-shirt" },
  { code: 4,  name: "Wireless Earbuds Pro",           category: "Gadget",  hot: true, image: "", link: "#", keywords: "earphone bluetooth" },
  { code: 5,  name: "Hydrating Sunscreen SPF50",      category: "Beauty",  image: "", link: "#", keywords: "sunblock" },
  { code: 6,  name: "Foldable Laundry Basket",        category: "Home",    tags: ["Baby"], image: "", link: "#", keywords: "bakul baju" },
  { code: 7,  name: "Bawal Instant Tudung",           category: "Fashion", image: "", link: "#", keywords: "hijab tudung" },
  { code: 8,  name: "Mini Portable Fan",              category: "Gadget",  hot: true, image: "", link: "#", keywords: "kipas" },
  { code: 12, name: "Glass Food Container Set",       category: "Home",    image: "", link: "#", keywords: "bekas makanan" },
  { code: 15, name: "Phone Tripod with Remote",       category: "Gadget",  image: "", link: "#", keywords: "stand" }
];
