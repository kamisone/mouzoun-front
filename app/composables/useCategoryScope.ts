/**
 * The two kinds of categories managed with the same screens: the farm shop's (`shop`, Admin ›
 * Boutique › Catégories) and the stays and activities' (`product`, Admin › Catalogue ›
 * Catégories). Gives a screen its API, routes, write permission, shared data key and the
 * differences: only shop categories have a public page (address, search preview, redirects),
 * menus visibility, a default product sort, subcategories and stock.
 */
export type CategoryScope = 'shop' | 'product'

export function useCategoryScope(scope: CategoryScope) {
  const admin = useAdminApi()
  const { can } = useShopAdmin()
  const shop = scope === 'shop'
  return {
    scope,
    shop,
    api: shop ? admin.shop.categories : admin.catalog.categories,
    /** Admin screens of the scope (list; `${base}/${id}` and `${base}/new` for the form). */
    base: shop ? '/admin/shop/categories' : '/admin/catalog/categories',
    /** `useAsyncData` key of the list, shared by the screens and the pickers. */
    listKey: shop ? 'admin-shop-categories' : 'admin-catalog-categories',
    /** Translation key of the screen title (and the breadcrumb). */
    titleKey: shop ? 'admin.shop.nav.categories' : 'admin.catalog.nav.categories',
    canWrite: () => can(shop ? 'shop.catalog' : 'products.write'),
  }
}
