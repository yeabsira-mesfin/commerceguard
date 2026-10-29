import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./qa',workers:1,retries:process.env.CI?1:0,
 reporter:[['list'],['html',{open:'never'}]],
 use:{baseURL:'http://127.0.0.1:3000',trace:'retain-on-failure',screenshot:'only-on-failure',...devices['Desktop Chrome']},
 webServer:[
  {command:'npm start',url:'http://127.0.0.1:3000',timeout:120000,reuseExistingServer:!process.env.CI,env:{BROWSER:'none',HOST:'127.0.0.1',PORT:'3000',CI:'false'}},
  {command:'cd ../backend && npm start',url:'http://127.0.0.1:3100/api/health',timeout:45000,reuseExistingServer:!process.env.CI}
 ]
});
