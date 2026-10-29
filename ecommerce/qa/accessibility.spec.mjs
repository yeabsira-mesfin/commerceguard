import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('CommerceGuard storefront and sign in have no serious WCAG failures',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/Considered essentials/})).toBeVisible();
 for(const path of ['/','/login']){
  await page.goto(path);
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
 }
});