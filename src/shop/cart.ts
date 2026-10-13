import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import { Cart, mutateCart, readCart } from './shopify';
type State = { cart: Cart|null; busy: boolean; error: string; add: (id:string)=>Promise<void>; quantity:(id:string,n:number)=>Promise<void>; sync:()=>Promise<void> };
export const useCartStore=create<State>()(persist((set,get)=>({
 cart:null,busy:false,error:'',
 add:async(id)=>{
  if(get().busy) return; set({busy:true,error:''});
  try{const cart=get().cart;set({cart:await mutateCart(cart?'cartLinesAdd':'cartCreate',cart?{cartId:cart.id,lines:[{merchandiseId:id,quantity:1}]}:{input:{lines:[{merchandiseId:id,quantity:1}]}})});}catch(e){const error=e instanceof Error?e.message:'Could not add item.';set({error});if(/cart not found|does not exist/i.test(error))set({cart:null});}finally{set({busy:false});}
 },
 quantity:async(id,n)=>{
  const cart=get().cart;if(!cart||get().busy)return;set({busy:true,error:''});
  try{set({cart:await mutateCart(n>0?'cartLinesUpdate':'cartLinesRemove',n>0?{cartId:cart.id,lines:[{id,quantity:n}]}:{cartId:cart.id,lineIds:[id]})});}catch(e){const error=e instanceof Error?e.message:'Could not update cart.';set({error});if(/cart not found|does not exist/i.test(error))set({cart:null});}finally{set({busy:false});}
 },
 sync:async()=>{const cart=get().cart;if(!cart||get().busy)return;set({busy:true,error:''});try{set({cart:await readCart(cart.id)});}catch(e){set({error:e instanceof Error?e.message:'Could not refresh cart.'});}finally{set({busy:false});}}
}),{name:'rhozeland-shop-cart',partialize:s=>({cart:s.cart})}));
export function useCartSync(){const sync=useCartStore(s=>s.sync);useEffect(()=>{void sync();const onVisible=()=>{if(document.visibilityState==='visible')void sync();};document.addEventListener('visibilitychange',onVisible);return()=>document.removeEventListener('visibilitychange',onVisible);},[sync]);}