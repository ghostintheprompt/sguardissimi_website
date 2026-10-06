const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
let now = '2026-10-06T23:59:59.999+02:00', tick;
const element = () => ({textContent:'', children:[], append(...items){this.children.push(...items)}, replaceChildren(){this.children=[]}});
const nodes = Object.fromEntries(['pfw-n','pfw-l','pfw-j','pfw-date','pfw-agenda'].map(id=>[id,element()]));
class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}}
const ctx = {Date:Clock,window:{},document:{getElementById:id=>nodes[id],createElement:element,addEventListener:()=>{}},setInterval:fn=>{tick=fn}};
vm.runInNewContext(script,ctx);
assert.equal(nodes['pfw-n'].textContent,'ADESSO');
now='2026-10-07T00:00:00+02:00';tick();
assert.equal(nodes['pfw-n'].textContent,'104');
assert.match(nodes['pfw-l'].textContent,/Moda uomo/);
assert.equal(nodes['pfw-agenda'].children.length,3);
assert.deepEqual(nodes['pfw-agenda'].children.map(row=>row.children[0].textContent),['Moda uomo','Haute Couture','Moda donna']);
for(const [date,mode,kind,n] of [
 ['2026-10-25T00:00:00+02:00','count','uomo','86'],
 ['2026-10-25T23:59:59+01:00','count','uomo','86'],
 ['2027-01-19T00:00:00+01:00','live','uomo','ADESSO'],
 ['2027-01-24T23:59:59.999+01:00','live','uomo','ADESSO'],
 ['2027-01-25T00:00:00+01:00','live','couture','ADESSO'],
 ['2027-01-29T00:00:00+01:00','count','donna','31'],
 ['2027-03-01T00:00:00+01:00','live','donna','ADESSO'],
 ['2027-06-22T00:00:00+02:00','live','uomo','ADESSO'],
 ['2027-07-05T00:00:00+02:00','live','couture','ADESSO'],
 ['2027-09-27T00:00:00+02:00','live','donna','ADESSO']
]){const result=ctx.window.sgPfwAt(new Date(date));assert.equal(result.mode,mode,date);assert.equal(result.event.kind,kind,date);assert.equal(result.n,n,date);}
now='2027-10-06T00:00:00+02:00';tick();
assert.equal(nodes['pfw-n'].textContent,'PARIGI');
assert.ok(nodes['pfw-agenda'].children.every(row=>row.children[1].textContent==='Prossime date da annunciare'));
console.log('Passed: all three calendars, open-tab rollover, Paris DST, final milliseconds, and unannounced dates.');
