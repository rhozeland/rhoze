import { useEffect, useState } from 'react';
import { ShoppingBag, Plus, Minus, Trash2, X, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Shell } from '@/create/shared';
import { Product, getProducts, getProduct, money, checkoutUrl } from './shopify';
import { useCartStore, useCartSync } from './cart';
import './shop.css';
function ProductItem({product,detail=false}:{product:Product;detail?:boolean}){
 const [selected,setSelected]=useState(product.variants.nodes[0]?.id ?? '');
 const variant=product.variants.nodes.find(v=>v.id===selected);
 const {add,busy}=useCartStore();
 const image=product.images.nodes[0];
 return <article className={detail?'rz-shop-detail':'rz-shop-product'}>
  <a href={`/product/${product.handle}`} className="rz-shop-image">{image&&<img src={image.url} alt={image.altText||product.title} loading="lazy"/>}</a>
  <div><a href={`/product/${product.handle}`}><h2>{product.title}</h2></a><p className={detail?'':'rz-shop-description'}>{product.description}</p>
   <label className="rz-shop-option">{product.variants.nodes.length>1?'Choose an option':'Option'}<select aria-label={`Options for ${product.title}`} value={selected} onChange={e=>setSelected(e.target.value)}>{product.variants.nodes.map(v=><option key={v.id} value={v.id}>{v.title}{!v.availableForSale?' — Sold out':''}</option>)}</select></label>
   <div className="rz-shop-buy"><strong>{variant&&money(variant.price)}</strong><Button variant="outline" className="rz-btn pri" disabled={busy||!variant?.availableForSale} onClick={()=>{if(variant)void add(variant.id);}}><Plus size={15}/>{variant?.availableForSale?'Add to cart':'Sold out'}</Button></div>
  </div>
 </article>;
}
function ShoppingCart(){
 const [open,setOpen]=useState(false);const {cart,busy,error,quantity,sync}=useCartStore();
 useEffect(()=>{if(open)void sync();},[open,sync]);
 useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[open]);
 return <><Button variant="outline" className="rz-btn" onClick={()=>setOpen(true)}><ShoppingBag size={16}/>Cart ({cart?.totalQuantity??0})</Button>
 {open&&<div className="rz-shop-shade" onClick={()=>setOpen(false)}><section role="dialog" aria-modal="true" aria-label="Shopping cart" className="rz-shop-cart" onClick={e=>e.stopPropagation()}><header><h2>Your cart</h2><Button variant="ghost" size="icon" aria-label="Close cart" onClick={()=>setOpen(false)}><X size={20}/></Button></header>
 <div className="rz-shop-lines">{!cart?.totalQuantity&&<p>Your cart is empty.</p>}{cart?.lines.nodes.map(line=><article key={line.id}>{line.merchandise.product.featuredImage&&<img src={line.merchandise.product.featuredImage.url} alt={line.merchandise.product.title}/>}<div><h3>{line.merchandise.product.title}</h3><p>{line.merchandise.title} · {money(line.merchandise.price)}</p><div className="rz-shop-quantity"><Button variant="outline" size="icon" aria-label="Decrease quantity" disabled={busy} onClick={()=>void quantity(line.id,line.quantity-1)}><Minus size={14}/></Button><span>{line.quantity}</span><Button variant="outline" size="icon" aria-label="Increase quantity" disabled={busy} onClick={()=>void quantity(line.id,line.quantity+1)}><Plus size={14}/></Button><Button variant="ghost" size="icon" aria-label="Remove item" disabled={busy} onClick={()=>void quantity(line.id,0)}><Trash2 size={14}/></Button></div></div></article>)}</div>
 {error&&<p role="alert">{error}</p>}<footer>{cart&&<p>Subtotal <strong>{money(cart.cost.subtotalAmount)}</strong></p>}<p>Shipping and taxes calculated at checkout. Reward redemption is not available yet.</p><Button variant="outline" className="rz-btn pri" disabled={busy||!cart?.totalQuantity} onClick={()=>{if(cart)window.open(checkoutUrl(cart),'_blank','noopener,noreferrer');}}>Checkout with Shopify <ArrowUpRight size={16}/></Button></footer>
 </section></div>}</>;
}
export default function Shop({handle}:{handle?:string}){
 useCartSync();const [products,setProducts]=useState<Product[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const cartError=useCartStore(s=>s.error);
 useEffect(()=>{let active=true;setLoading(true);(handle?getProduct(handle).then(p=>p?[p]:[]):getProducts()).then(ps=>{if(active)setProducts(ps);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Shop unavailable.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[handle]);
 return <section className="rz-shop"><header className="rz-shop-heading"><div>{handle&&<a href="/rewards?tab=shop">← Back to shop</a>}<h2>Rhozeland Shop</h2><p>Objects, apparel and things we make.</p></div><ShoppingCart/></header>{(error||cartError)&&<p role="alert">{error||cartError}</p>}{loading?<p>Loading products…</p>:!products.length&&!error?<p>No products found.</p>:<div className={handle?'':'rz-shop-grid'}>{products.map(p=><ProductItem key={p.id} product={p} detail={Boolean(handle)}/>)}</div>}</section>;
}
export function ShopProductPage({handle}:{handle:string}){return <Shell><Shop handle={handle}/></Shell>;}