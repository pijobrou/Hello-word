import { JSDOM } from 'jsdom';
import fs from 'fs';
const liquid = fs.readFileSync(process.argv[2], 'utf8');
const script = liquid.slice(liquid.lastIndexOf('<script>') + 8, liquid.indexOf('</script>', liquid.lastIndexOf('<script>')));
const prem = ['Alpaca','Clouds'], basic = ['Bunny','Owl'];
const variants = []; let id = 1;
for (const c of prem) for (const s of ['90','100','110']) variants.push({ id: id++, color: c, size: s, price: 1205, available: true, premium: true });
for (const c of basic) for (const s of ['90','100']) variants.push({ id: id++, color: c, size: s, price: 695, available: true, premium: false });
const i18n = { offerA:'A [get]', offerB:'B [get]', offerC:'C [get]', nudgeGetA:'getA [count]', nudgeBuyA:'buyA [count]', nudgeB:'B+[count]', nudgeC:'C+[count]', nudgeShipping:'ship [amount]', shippingFree:'shipfree', addButton:'Add', addButtonCount:'Add [count]', adding:'..', added:'added [count]', viewCart:'cart', checkout:'co', error:'err' };
const config = { variants, offers:{enabled:true,a:{buy:6,get:2},b:{buy:8,get:2},c:{buy:6,get:1}}, freeShipping:3900, currency:'CAD', locale:'fr', root:'/', i18n };
const card = c => `<div class="cn-print" data-color="${c}"><p class="cn-print__na" hidden></p><div class="cn-stepper"><button data-step="-1"></button><output>0</output><button data-step="1"></button></div></div>`;
const html = `<cn-pack-builder>
 <div><button class="cn-pill" data-size="90" aria-pressed="true"></button><button class="cn-pill" data-size="100" aria-pressed="false"></button><button class="cn-pill" data-size="110" aria-pressed="false"></button></div>
 ${[...prem,...basic].map(card).join('')}
 <strong data-sum-count></strong><strong data-sum-subtotal></strong><div data-sum-offer></div><div data-sum-saving-row><strong data-sum-saving></strong></div><strong data-sum-total></strong><div data-sum-nudge></div><button data-add></button><div data-status></div>
 <script type="application/json" data-pack-config>${JSON.stringify(config)}</script></cn-pack-builder>`;
const dom = new JSDOM(`<body>${html}</body>`, { runScripts: 'outside-only' });
const w = dom.window;
w.eval(script);
const el = w.document.querySelector('cn-pack-builder');
const click = (color, n=1, d=1) => { for (let k=0;k<n;k++) el.querySelector(`.cn-print[data-color="${color}"] [data-step="${d}"]`).click(); };
const state = label => console.log(label.padEnd(34), '| pairs', el.querySelector('[data-sum-count]').textContent, '| offer:', el.querySelector('[data-sum-offer]').textContent || '-', '| saving', el.querySelector('[data-sum-saving-row]').hidden ? '-' : el.querySelector('[data-sum-saving]').textContent, '| total', el.querySelector('[data-sum-total]').textContent, '| nudge:', el.querySelector('[data-sum-nudge]').textContent, '| btn:', el.querySelector('[data-add]').textContent);
state('empty');
click('Alpaca',3); click('Clouds',3); state('6 premium (90)');
click('Bunny',1); state('6 premium + 1 basic');
click('Owl',1); state('6 premium + 2 basic -> A');
el.querySelector('.cn-pill[data-size="110"]').click();
console.log('110: Bunny unavailable?', el.querySelector('.cn-print[data-color="Bunny"]').classList.contains('is-unavailable'), '| plus disabled?', el.querySelector('.cn-print[data-color="Bunny"] [data-step="1"]').disabled);
el.querySelector('.cn-pill[data-size="90"]').click();
click('Alpaca',3,-1); click('Clouds',3,-1); state('2 basic only');
click('Bunny',4); state('6 basic');
click('Owl',1); state('7 basic -> C');
click('Owl',1); state('8 basic');
click('Owl',2); state('10 basic -> B');
