import {createSlice} from '@reduxjs/toolkit';
const cartSlice=createSlice({
  name:'cart',initialState:{items:[]},
  reducers:{
    addItemToCart:(state,action)=>{const found=state.items.find(x=>x.id===action.payload.id);if(found)found.quantity=Math.min(99,found.quantity+1);else state.items.push({...action.payload,quantity:1});},
    removeItemFromCart:(state,action)=>{state.items=state.items.filter(x=>x.id!==action.payload);},
    setQuantity:(state,action)=>{const found=state.items.find(x=>x.id===action.payload.id);if(found)found.quantity=Math.max(1,Math.min(99,Number(action.payload.quantity)||1));},
    clearCart:(state)=>{state.items=[];}
  }
});
export const {addItemToCart,removeItemFromCart,setQuantity,clearCart}=cartSlice.actions;
export default cartSlice.reducer;
