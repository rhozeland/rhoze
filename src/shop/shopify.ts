export type Money = { amount: string; currencyCode: string };
export type Variant = { id: string; title: string; availableForSale: boolean; price: Money; selectedOptions: { name: string; value: string }[] };
export type Product = { id: string; handle: string; title: string; description: string; images: { nodes: { url: string; altText: string | null }[] }; variants: { nodes: Variant[] } };
export type Cart = { id: string; checkoutUrl: string; totalQuantity: number; cost: { subtotalAmount: Money }; lines: { nodes: { id: string; quantity: number; merchandise: Variant & { product: { title: string; handle: string; featuredImage: { url: string; altText: string | null } | null } } }[] } };
const endpoint = 'https://58rtwh-rn.myshopify.com/api/2025-07/graphql.json';
// Public Storefront token only; never use an Admin token in the browser.
const token = '08debb61f6ada272c3819eda683e36f0';
export async function storefrontApiRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
 const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': token }, body: JSON.stringify({ query, variables }) });
 if (!response.ok) throw new Error(response.status === 402 ? 'Shopify requires an active billing plan.' : 'The shop is unavailable. Please try again.');
 const result = await response.json();
 if (result.errors?.length) throw new Error(result.errors.map((e: {message: string}) => e.message).join('; '));
 return result.data as T;
}
const productFields = `id handle title description images(first:5){nodes{url altText}} variants(first:100){nodes{id title availableForSale price{amount currencyCode} selectedOptions{name value}}}`;
export async function getProducts(): Promise<Product[]> { return (await storefrontApiRequest<{products:{nodes:Product[]}}>(`query{products(first:50){nodes{${productFields}}}}`)).products.nodes; }
export async function getProduct(handle: string): Promise<Product | null> { return (await storefrontApiRequest<{product:Product|null}>(`query($handle:String!){product(handle:$handle){${productFields}}}`, {handle})).product; }
export const cartFields = `id checkoutUrl totalQuantity cost{subtotalAmount{amount currencyCode}} lines(first:100){nodes{id quantity merchandise{... on ProductVariant{id title availableForSale price{amount currencyCode} selectedOptions{name value} product{title handle featuredImage{url altText}}}}}}`;
export async function readCart(id: string) { return (await storefrontApiRequest<{cart:Cart|null}>(`query($id:ID!){cart(id:$id){${cartFields}}}`,{id})).cart; }
export async function mutateCart(operation: 'cartCreate'|'cartLinesAdd'|'cartLinesUpdate'|'cartLinesRemove', variables: Record<string, unknown>): Promise<Cart> {
 const signatures = {cartCreate:'$input:CartInput!',cartLinesAdd:'$cartId:ID!,$lines:[CartLineInput!]!',cartLinesUpdate:'$cartId:ID!,$lines:[CartLineUpdateInput!]!',cartLinesRemove:'$cartId:ID!,$lineIds:[ID!]!'};
 const args = operation==='cartCreate' ? 'input:$input' : operation==='cartLinesRemove' ? 'cartId:$cartId,lineIds:$lineIds' : 'cartId:$cartId,lines:$lines';
 const result = await storefrontApiRequest<Record<string,{cart:Cart|null;userErrors:{message:string}[]}>>(`mutation(${signatures[operation]}){${operation}(${args}){cart{${cartFields}} userErrors{message}}}`,variables);
 const payload=result[operation];
 if(payload.userErrors.length) throw new Error(payload.userErrors.map(e=>e.message).join('; '));
 if(!payload.cart) throw new Error('Cart not found. Please add your item again.');
 return payload.cart;
}
export function checkoutUrl(cart: Cart): string { const url=new URL(cart.checkoutUrl); url.searchParams.set('channel','online_store'); return url.toString(); }
export function money(value: Money) { return new Intl.NumberFormat(undefined,{style:'currency',currency:value.currencyCode}).format(Number(value.amount)); }