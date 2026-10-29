import {test,expect} from '@playwright/test';

test('admin inventory creation, product detail and local password recovery',async({page,request},testInfo)=>{
 await page.goto('/login');
 await page.getByLabel('Email address').fill('admin@commerceguard.test');
 await page.getByLabel('Password').fill(process.env.DEMO_ADMIN_PASSWORD);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('link',{name:'Admin'}).click();
 await expect(page.getByRole('heading',{name:'Commerce operations'})).toBeVisible();
 const product='Synthetic Browser QA Product '+Date.now();
 await page.getByRole('heading',{name:'Create product'}).locator('..').getByLabel('Name').fill(product);
 await page.getByRole('heading',{name:'Create product'}).locator('..').getByLabel('Description').fill('Verified by Chromium');
 await page.getByRole('heading',{name:'Create product'}).locator('..').getByLabel('Price (USD)').fill('29.50');
 await page.getByRole('button',{name:'Add product'}).click();
 await expect(page.getByText('Product created')).toBeVisible();
 await expect(page.getByText(product).first()).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:testInfo.outputPath('commerceguard-admin.png'),fullPage:true});
 await page.getByRole('link',{name:'Shop',exact:true}).click();
 await page.getByRole('link',{name:product}).click();
 await expect(page.getByRole('heading',{name:product}).first()).toBeVisible();
 await page.getByRole('button',{name:'Sign out'}).click();
 const email='qa-reset-'+Date.now()+'@example.test';
 const customer=await request.post('http://127.0.0.1:3100/api/auth/register',{
  data:{name:'QA Recovery Account',email,password:process.env.DEMO_ADMIN_PASSWORD}
 });
 expect(customer.status()).toBe(201);
 await page.goto('/reset-password');
 await page.getByRole('heading',{name:'Password recovery demo'}).waitFor();
 await page.getByLabel('Email address').fill(email);
 await page.getByRole('button',{name:'Request reset token'}).click();
 await expect(page.getByText(/LOCAL DEMO TOKEN/)).toBeVisible();
 await page.getByLabel('New password').fill('synthetic-qa-updated-password-2026');
 await page.getByRole('button',{name:'Reset password'}).click();
 await expect(page.getByText('Password changed')).toBeVisible();
 await page.getByRole('link',{name:'Back to sign in'}).click();
 await page.getByLabel('Email address').fill(email);
 await page.getByLabel('Password').fill('synthetic-qa-updated-password-2026');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Hello, QA/})).toBeVisible();
});
