type PortfolioLanguage = { language: string };

const englishOptions: Record<string, string> = {
  "Campañas": "Campaigns",
  "Cabello": "Hair",
  "Familia": "Family",
  "Empresas": "Business",
  "Lugares": "Places",
  "Fotografía": "Photography",
  "Maternidad": "Motherhood",
  "Hogar": "Home",
  "Belleza": "Beauty",
  "Cuidado del cabello": "Haircare",
  "Maquillaje": "Makeup",
  "Hoteles": "Hotels",
  "Restaurantes": "Restaurants",
  "Productos": "Products",
  "Fotografía UGC": "UGC Photography",
  "Reel colaborativo": "Collaborative Reel",
  "Historias": "Stories",
  "Voice over": "Voice-over",
  "Ads para redes": "Social Media Ads",
  "Derechos de pauta": "Paid Usage Rights",
  "Testimonios": "Testimonials",
  "Tutoriales": "Tutorials",
  "Reseñas": "Reviews",
  "Concepto creativo": "Creative Concept",
  "Guion estratégico": "Strategic Script",
  "Grabación": "Filming",
  "Edición": "Editing",
  "Formato vertical": "Vertical Format",
  "Subtítulos": "Subtitles",
  "Entrega de brutos": "Raw Footage Delivery",
};

export function portfolioText(data: PortfolioLanguage, spanish: string, english: string) {
  return data.language === "en" ? english : spanish;
}

export function portfolioOption(data: PortfolioLanguage, value: string) {
  return data.language === "en" ? englishOptions[value] ?? value : value;
}

export function portfolioOptions(data: PortfolioLanguage, values: string[]) {
  return values.map((value) => portfolioOption(data, value));
}
