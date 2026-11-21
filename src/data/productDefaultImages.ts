import vermicompostImg from '../assets/images/vermicompost_grade_a_1794572561601.jpg';
import compostImg from '../assets/images/traditional_compost_1794572562702.jpg';
import wormTeaImg from '../assets/images/worm_tea_liquid_1794572563137.jpg';
import zeoliteImg from '../assets/images/zeolite_sugar_mesh_1794572563027.jpg';
import coffeeSubstrateImg from '../assets/images/coffee_substrate_1794572564729.jpg';
import earthwormsImg from '../assets/images/live_earthworms_1794572563487.jpg';
import { StoreProduct } from '../types/storefront';

export const PRODUCT_DEFAULT_IMAGES_BY_ID: Record<string, string> = {
  'prod-vermicompost-grade-a': vermicompostImg,
  'prod-traditional-compost': compostImg,
  'prod-worm-tea-liquid': wormTeaImg,
  'prod-zeolite-sugar-mesh': zeoliteImg,
  'prod-coffee-substrate': coffeeSubstrateImg,
  'prod-live-earthworms': earthwormsImg,
};

export const PRODUCT_DEFAULT_IMAGES_BY_CATEGORY: Record<string, string> = {
  vermicompost: vermicompostImg,
  compost: compostImg,
  liquid: wormTeaImg,
  mineral: zeoliteImg,
  substrate: coffeeSubstrateImg,
  starter: earthwormsImg,
};

export function getProductImageSrc(
  product: Pick<StoreProduct, 'id' | 'category' | 'imageUrl'>
): string {
  if (product.imageUrl && product.imageUrl.trim()) {
    return product.imageUrl;
  }
  return (
    PRODUCT_DEFAULT_IMAGES_BY_ID[product.id] ||
    PRODUCT_DEFAULT_IMAGES_BY_CATEGORY[product.category] ||
    vermicompostImg
  );
}
