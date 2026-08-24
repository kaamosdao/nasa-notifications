/**
 * Переиспользуемые populate/fields для запросов к Strapi — чтобы не тянуть лишние колонки.
 * Правишь здесь → эффект во всех фетчерах сразу.
 */

/**
 * Поля медиа, реально нужные фронту. `srcSet` строится через imgproxy из `url`
 * (src/shared/ui/media-image/utils/get-sources.ts), поэтому Strapi `formats` НЕ нужен.
 * Перед добавлением/удалением поля проверь потребителей:
 *   grep -rn "formats" src/shared/ui/media-image src/shared/utils
 */
export const MEDIA_FIELDS = [
  "url",
  "width",
  "height",
  "mime",
  "alternativeText",
];

/**
 * Populate для компонента `shared.media` с брейкпоинтами — только нужные поля медиа,
 * вместо `populate: "*"` (которое тянет hash/ext/size/provider/provider_metadata/даты).
 */
export const mediaBreakpointsPopulate = {
  media: { fields: MEDIA_FIELDS },
  lg: { fields: MEDIA_FIELDS },
  md: { fields: MEDIA_FIELDS },
  sm: { fields: MEDIA_FIELDS },
  xs: { fields: MEDIA_FIELDS },
};
