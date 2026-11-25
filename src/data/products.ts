export type CategoryId =
  | 'all'
  | 'hoodies'
  | 'sweatshirts'
  | 'longsleeves'
  | 'pants'
  | 'jeans';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  count: number;
}

export interface HeroVariant {
  id: string;
  index: string;
  label: string;
  colorName: string;
  hex: string;
  subtitle: string;
  image: string;
  zoneLabel: string;
}

export interface BaseProduct {
  id: string;
  sku: string;
  title: string;
  categoryLabel: string;
  price: number;
  priceFormatted: string;
  description: string;
  material: string;
  fit: string;
  sizes: string[];
  image: string;
  modelImage?: string;
}

export interface BestsellerItem extends BaseProduct {
  tag: string;
  modelImage: string;
}

export interface CatalogItem extends BaseProduct {
  category: Exclude<CategoryId, 'all'>;
}

export const HERO_VARIANTS: HeroVariant[] = [
  {
    id: 'ash-grey',
    index: '01',
    label: 'ASH GREY',
    colorName: 'Пепельно-серый',
    hex: '#92969B',
    subtitle: 'Half-Zip Heavy Fleece · 480 GSM',
    image: '/images/hero-1.png',
    zoneLabel: 'Левая зона',
  },
  {
    id: 'chalk-white',
    index: '02',
    label: 'CHALK WHITE',
    colorName: 'Молочный мел',
    hex: '#E6E4DE',
    subtitle: 'Half-Zip Heavy Fleece · 480 GSM',
    image: '/images/hero-2.png',
    zoneLabel: 'Центр',
  },
  {
    id: 'espresso',
    index: '03',
    label: 'ESPRESSO',
    colorName: 'Тёмный эспрессо',
    hex: '#3E3029',
    subtitle: 'Half-Zip Heavy Fleece · 480 GSM',
    image: '/images/hero-3.png',
    zoneLabel: 'Правая зона',
  },
];

export const BESTSELLERS: BestsellerItem[] = [
  {
    id: 'bs-01',
    sku: 'NVM-BS-01',
    tag: 'Drop 01 · Outerwear',
    title: 'OBSIDIAN GLOSS PUFFER',
    categoryLabel: 'Верхняя одежда',
    price: 28900,
    priceFormatted: '28 900 ₽',
    description:
      'Объёмный пуховик из плотного лакированного нейлона с высокой стойкой, двойной металлической молнией и укороченной архитектурной посадкой.',
    material: '100% глянцевый ripstop-нейлон, наполнитель 90/10 пух-перо',
    fit: 'Boxy Cropped Fit',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/bestseller-1.png',
    modelImage: '/images/bestseller-model-1.png',
  },
  {
    id: 'bs-02',
    sku: 'NVM-BS-02',
    tag: 'Drop 02 · Jersey',
    title: 'DISTRESSED FLAG LONGSLEEVE',
    categoryLabel: 'Лонгслив',
    price: 11900,
    priceFormatted: '11 900 ₽',
    description:
      'Свободный лонгслив с открытой линией горловины и состаренным монохромным принтом в гранж-эстетике. Спущенная линия плеча и необработанный край.',
    material: '100% вываренный хлопок · 320 GSM',
    fit: 'Relaxed Wide Neck',
    sizes: ['XS', 'S', 'M', 'L'],
    image: '/images/bestseller-2.png',
    modelImage: '/images/bestseller-model-2.png',
  },
  {
    id: 'bs-03',
    sku: 'NVM-BS-03',
    tag: 'Drop 03 · Winter Archive',
    title: 'ARCTIC CHALK FUR BOMBER',
    categoryLabel: 'Верхняя одежда',
    price: 31500,
    priceFormatted: '31 500 ₽',
    description:
      'Молочный пуховый бомбер с квадратной стёжкой, массивным воротником-стойкой и съёмным утеплённым капюшоном с отделкой из объёмного меха.',
    material: 'Матовый ветрозащитный полиэстер, съёмный капюшон с мехом',
    fit: 'Structured Oversized',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/bestseller-3.png',
    modelImage: '/images/bestseller-model-3.png',
  },
  {
    id: 'bs-04',
    sku: 'NVM-BS-04',
    tag: 'Drop 04 · Layered',
    title: 'CHROME TRIBAL LAYERED LONG',
    categoryLabel: 'Лонгслив',
    price: 13400,
    priceFormatted: '13 400 ₽',
    description:
      'Двухслойный лонгслив с эффектом футболки поверх рукавов, контрастной отстрочкой по швам и детализированным готическим трафаретным принтом.',
    material: '100% плотный джерси-хлопок · 340 GSM',
    fit: 'Double-Sleeve Boxy',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/bestseller-4.png',
    modelImage: '/images/bestseller-model-4.png',
  },
];

export const CATALOG_CATEGORIES: CategoryMeta[] = [
  { id: 'all', label: 'Все вещи', count: 20 },
  { id: 'hoodies', label: 'Худи', count: 4 },
  { id: 'sweatshirts', label: 'Свитшоты', count: 4 },
  { id: 'longsleeves', label: 'Лонгсливы', count: 4 },
  { id: 'pants', label: 'Штаны', count: 4 },
  { id: 'jeans', label: 'Джинсы', count: 4 },
];

export const CATALOG_ITEMS: CatalogItem[] = [
  // Худи (4)
  {
    id: 'hd-01',
    sku: 'NVM-HD-01',
    category: 'hoodies',
    categoryLabel: 'Худи',
    title: 'INK DRAGON ZIP HOODIE',
    price: 14900,
    priceFormatted: '14 900 ₽',
    description:
      'Серое зип-худи из тяжёлого флиса с асимметричной тушевой графикой дракона и каллиграфией по левой полочке.',
    material: '100% плотный хлопок-футер · 480 GSM',
    fit: 'Drop-Shoulder Oversized',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/hoodie-1.jpg',
  },
  {
    id: 'hd-02',
    sku: 'NVM-HD-02',
    category: 'hoodies',
    categoryLabel: 'Худи',
    title: 'CHALK SCRIPT ZIP HOODIE',
    price: 14500,
    priceFormatted: '14 500 ₽',
    description:
      'Белоснежное укороченное зип-худи с плотным двойным капюшоном и вертикальным каллиграфическим принтом вдоль правого борта.',
    material: '100% плотный хлопок-футер · 460 GSM',
    fit: 'Cropped Boxy Fit',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/hoodie-2.jpg',
  },
  {
    id: 'hd-03',
    sku: 'NVM-HD-03',
    category: 'hoodies',
    categoryLabel: 'Худи',
    title: 'THORN LILY ZIP HOODIE',
    price: 15200,
    priceFormatted: '15 200 ₽',
    description:
      'Угольно-чёрное зип-худи с графичным ботаническим принтом в технике вытравки и плотной резинкой на манжетах.',
    material: '100% плотный хлопок-футер · 480 GSM',
    fit: 'Boxy Street Fit',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/hoodie-3.jpg',
  },
  {
    id: 'hd-04',
    sku: 'NVM-HD-04',
    category: 'hoodies',
    categoryLabel: 'Худи',
    title: 'RAW MELANGE BLANK HOODIE',
    price: 12900,
    priceFormatted: '12 900 ₽',
    description:
      'Архитектурное базовое худи без лишних деталей. Глубокий перекрёстный капюшон, усиленный карман-кенгуру и массивный объём.',
    material: '100% органический футер 3-нитка · 500 GSM',
    fit: 'Heavyweight Oversized',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/hoodie-4.jpg',
  },

  // Свитшоты (4)
  {
    id: 'sw-01',
    sku: 'NVM-SW-01',
    category: 'sweatshirts',
    categoryLabel: 'Свитшоты',
    title: 'CHARCOAL CREST POLO SWEAT',
    price: 13200,
    priceFormatted: '13 200 ₽',
    description:
      'Тёмно-графитовый свитшот с отложным воротником-поло, тремя матовыми пуговицами и минималистичной вышивкой на груди.',
    material: '100% брашированный хлопок · 440 GSM',
    fit: 'Relaxed Polo Fit',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/sweatshirt-1.jpg',
  },
  {
    id: 'sw-02',
    sku: 'NVM-SW-02',
    category: 'sweatshirts',
    categoryLabel: 'Свитшоты',
    title: 'ESPRESSO HERITAGE POLO',
    price: 13500,
    priceFormatted: '13 500 ₽',
    description:
      'Свитшот в оттенке эспрессо с контрастной кремовой вышивкой и плотным трикотажным воротником.',
    material: '100% хлопок-флис · 440 GSM',
    fit: 'Boxy Dropped Shoulder',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/sweatshirt-2.jpg',
  },
  {
    id: 'sw-03',
    sku: 'NVM-SW-03',
    category: 'sweatshirts',
    categoryLabel: 'Свитшоты',
    title: 'ROSE STRIPE RUGBY CREW',
    price: 12800,
    priceFormatted: '12 800 ₽',
    description:
      'Объёмный регби-свитшот с широкой горизонтальной полосой и структурированной планкой на пуговицах.',
    material: '100% плотный пике-футер · 420 GSM',
    fit: 'Wide Rugby Fit',
    sizes: ['XS', 'S', 'M', 'L'],
    image: '/images/catalog/sweatshirt-3.jpg',
  },
  {
    id: 'sw-04',
    sku: 'NVM-SW-04',
    category: 'sweatshirts',
    categoryLabel: 'Свитшоты',
    title: 'ROASTED UMBER CREST CREW',
    price: 12400,
    priceFormatted: '12 400 ₽',
    description:
      'Свободный свитшот глубокого кофейного цвета с кремовым гербом и высокой горловиной в рубчик.',
    material: '100% вываренный футер · 450 GSM',
    fit: 'Oversized Crew',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/sweatshirt-4.jpg',
  },

  // Лонгсливы (4)
  {
    id: 'ls-01',
    sku: 'NVM-LS-01',
    category: 'longsleeves',
    categoryLabel: 'Лонгсливы',
    title: 'MARANELLO ARCHIVE LONG',
    price: 9800,
    priceFormatted: '9 800 ₽',
    description:
      'Белоснежный оверсайз-лонгслив из плотного кулирного полотна с винтажным бордовым принтом по центру.',
    material: '100% гребенной хлопок · 300 GSM',
    fit: 'Relaxed Straight Fit',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/longsleeve-1.jpg',
  },
  {
    id: 'ls-02',
    sku: 'NVM-LS-02',
    category: 'longsleeves',
    categoryLabel: 'Лонгсливы',
    title: 'ASH & NOIR STRIPE LONG',
    price: 9400,
    priceFormatted: '9 400 ₽',
    description:
      'Тяжёлый лонгслив в широкую угольно-серую полоску с эффектом лёгкой винтажной стирки и плотным воротом.',
    material: '100% washed-хлопок · 320 GSM',
    fit: 'Boxy Oversized',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/longsleeve-2.jpg',
  },
  {
    id: 'ls-03',
    sku: 'NVM-LS-03',
    category: 'longsleeves',
    categoryLabel: 'Лонгсливы',
    title: 'FADED INK TYPO LONGSLEEVE',
    price: 10200,
    priceFormatted: '10 200 ₽',
    description:
      'Вываренный графитовый лонгслив с крупным полупрозрачным типографическим принтом во всю грудь.',
    material: '100% garment-dyed хлопок · 310 GSM',
    fit: 'Wide Boxy Fit',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/longsleeve-3.jpg',
  },
  {
    id: 'ls-04',
    sku: 'NVM-LS-04',
    category: 'longsleeves',
    categoryLabel: 'Лонгсливы',
    title: 'ALABASTER CYBER CROSS LONG',
    price: 10900,
    priceFormatted: '10 900 ₽',
    description:
      'Свободный молочный лонгслив с кибер-орнаментом, текстовой графикой и контрастными тройными полосами на рукавах.',
    material: '100% хлопок джерси · 310 GSM',
    fit: 'Dropped Shoulder',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/longsleeve-4.jpg',
  },

  // Штаны (4)
  {
    id: 'pt-01',
    sku: 'NVM-PT-01',
    category: 'pants',
    categoryLabel: 'Штаны',
    title: 'ASH SCRIPT WIDE SWEATPANTS',
    price: 13900,
    priceFormatted: '13 900 ₽',
    description:
      'Экстра-широкие спортивные штаны серого меланжа со свободным прямым кроем и вертикальным росчерком вдоль штанины.',
    material: '100% тяжёлый хлопок-футер · 460 GSM',
    fit: 'Extra Wide Straight',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/pants-1.jpg',
  },
  {
    id: 'pt-02',
    sku: 'NVM-PT-02',
    category: 'pants',
    categoryLabel: 'Штаны',
    title: 'NOIR SIGIL WIDE SWEATS',
    price: 14200,
    priceFormatted: '14 200 ₽',
    description:
      'Чёрные объёмные штаны с графичным киберсигилизм-принтом с серебристым эффектом и глубокими боковыми карманами.',
    material: '100% плотный хлопок-футер · 460 GSM',
    fit: 'Baggy Wide Fit',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/pants-2.jpg',
  },
  {
    id: 'pt-03',
    sku: 'NVM-PT-03',
    category: 'pants',
    categoryLabel: 'Штаны',
    title: 'SCULPT FLARED FOLD PANTS',
    price: 13600,
    priceFormatted: '13 600 ₽',
    description:
      'Расклешённые чёрные брюки из эластичного трикотажа с широким отворотом на талии и тонкой контурной линией сбоку.',
    material: '92% хлопок премиум-интерлок, 8% эластан',
    fit: 'Sculpted Flared',
    sizes: ['XS', 'S', 'M', 'L'],
    image: '/images/catalog/pants-3.jpg',
  },
  {
    id: 'pt-04',
    sku: 'NVM-PT-04',
    category: 'pants',
    categoryLabel: 'Штаны',
    title: 'VINTAGE UNION SWEATPANTS',
    price: 13800,
    priceFormatted: '13 800 ₽',
    description:
      'Объёмные серые штаны с необработанным широким низом, эластичным поясом и состаренным монохромным принтом внизу.',
    material: '100% плотный футер-петля · 470 GSM',
    fit: 'Balloon Wide Fit',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/pants-4.jpg',
  },

  // Джинсы (4)
  {
    id: 'jn-01',
    sku: 'NVM-JN-01',
    category: 'jeans',
    categoryLabel: 'Джинсы',
    title: 'SHADOW FLORA BAGGY DENIM',
    price: 16900,
    priceFormatted: '16 900 ₽',
    description:
      'Угольно-чёрные мешковатые джинсы из жёсткого денима с деликатным тональным флоральным орнаментом по всей длине.',
    material: '100% хлопок, сырой деним · 14.5 OZ',
    fit: 'Ultra Baggy Fit',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/jeans-1.jpg',
  },
  {
    id: 'jn-02',
    sku: 'NVM-JN-02',
    category: 'jeans',
    categoryLabel: 'Джинсы',
    title: 'AZURE DRAGON LASER JEANS',
    price: 17400,
    priceFormatted: '17 400 ₽',
    description:
      'Вываренный голубой деним широкого кроя с лазерной гравировкой дракона и иероглифов по обеим штанинам.',
    material: '100% хлопковый деним · 14 OZ',
    fit: 'Wide Baggy Street',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/jeans-2.jpg',
  },
  {
    id: 'jn-03',
    sku: 'NVM-JN-03',
    category: 'jeans',
    categoryLabel: 'Джинсы',
    title: 'GRAPHITE WHISKER BALLOON',
    price: 16400,
    priceFormatted: '16 400 ₽',
    description:
      'Тёмно-графитовые баллонные джинсы с эффектом вытертого винтажного окрашивания и массивным силуэтом от бедра.',
    material: '100% хлопок stone-wash деним · 14.5 OZ',
    fit: 'Balloon Wide Cut',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/jeans-3.jpg',
  },
  {
    id: 'jn-04',
    sku: 'NVM-JN-04',
    category: 'jeans',
    categoryLabel: 'Джинсы',
    title: 'INDIGO CALLIGRAPHY DENIM',
    price: 17100,
    priceFormatted: '17 100 ₽',
    description:
      'Широкие синие джинсы с винтажным состариванием и крупным светлым каллиграфическим контуром на левой ноге.',
    material: '100% хлопковый деним · 14 OZ',
    fit: 'Oversized Wide Leg',
    sizes: ['S', 'M', 'L', 'XL'],
    image: '/images/catalog/jeans-4.jpg',
  },
];
