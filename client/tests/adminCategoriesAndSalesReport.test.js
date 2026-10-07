import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { transform } from 'esbuild';

const require = createRequire(import.meta.url);
async function loadComponent(file, mocks, globals = {}) {
  const source = await readFile(new URL('../src/app/pages/admin/' + file, import.meta.url), 'utf8');
  const { code } = await transform(source, {loader:'jsx',format:'cjs',jsx:'automatic'});
  const module = {exports:{}};
  vm.runInNewContext(code, {module,exports:module.exports,require:name=>mocks[name] || require(name),
    console,Date,Intl,setTimeout,clearTimeout,...globals});
  return module.exports;
}
function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  const children = [element.props?.children].flat(Infinity);
  return [element,...children.flatMap(nodes)];
}
const placeholders = new Proxy({}, {get:(_,name)=>String(name)});

test('category search matches names/descriptions regardless of case and displays no-match state', async () => {
  const categories = [{category_id:1,name:'Electric Guitars',description:'Six strings'},
    {category_id:2,name:'Accessories',description:'Guitar cables'}];
  const {ProductCategoriesTab} = await loadComponent('tabs/ProductCategoriesTab.jsx', {
    'motion/react':{motion:{div:'div'}},
    '../components/categories/CategoryTreeView':{CategoryTreeView:'CategoryTreeView'},
  });
  for (const [query,ids] of [[' ELECTRIC ',[1]],['CABLES',[2]],['',[1,2]],['missing',[]]]) {
    const tree = nodes(ProductCategoriesTab({categories,searchQuery:query})).find(n=>n.type==='CategoryTreeView');
    assert.deepEqual(Array.from(tree.props.categories,c=>c.category_id), ids);
    assert.equal(tree.props.isSearching, Boolean(query.trim()));
  }
  const {CategoryTreeView} = await loadComponent('components/categories/CategoryTreeView.jsx', {'lucide-react':placeholders});
  const tree = CategoryTreeView({categories:[],isSearching:true,isSuperAdmin:true});
  assert.ok(nodes(tree).some(n=>n.props?.children==='No categories match your search'));
  assert.equal(nodes(tree).filter(n=>n.type==='button').length,0);
});

test('printing requests the entire selected report and Excel sends filters instead of a page snapshot', async () => {
  let stateIndex = 0;
  const states = ['online','custom','2026-10-01','2026-10-07',
    {search:' Customer ',status:'completed',payment_status:'approved',payment_method:'cash'},'amount','asc',3,10];
  const requests = [], exports = [], alerts = [];
  let output = '', opened = false;
  const popup = {closed:false,document:{write(html){output+=html;},open(){output='';},close(){}},close(){this.closed=true;}};
  const fullReport = {summary:{netSales:25,totalTransactions:25},transactions:Array.from({length:25},(_,i)=>({
    transaction_number:'ORDER-'+(i+1),date:'2026-10-01',customer_name:'Customer',net_amount:1,gross_amount:1,
  }))};
  const {SalesReportTab} = await loadComponent('tabs/SalesReportTab.jsx', {
    react:{useState(initial){const i=stateIndex++;return [i<states.length?states[i]:initial,()=>{}];},
      useMemo:fn=>fn(),useCallback:fn=>fn,useEffect(){},useRef:value=>({current:value})},
    'motion/react':{motion:{div:'div'},AnimatePresence:'div'},'lucide-react':placeholders,'recharts':placeholders,
    '../../../utils/formatCurrency':{formatCurrency:v=>'PHP '+(v||0)},
    '../../../context/AuthContext':{useAuth:()=>({user:{email:'admin@example.com'}})},
    '../../../context/SocketContext':{useSocketEvent(){},useSocket:()=>({})},
    '../../../utils/adminApi':{adminApi:{async getSalesReport(params){assert.equal(opened,true);requests.push(params);return {data:fullReport};},
      async exportSalesExcel(params){exports.push(params);return {};}}},
  },{window:{open(){opened=true;return popup;},URL:{createObjectURL:()=>'',revokeObjectURL(){}}},
    document:{createElement:()=>({setAttribute(){},click(){},remove(){}}),body:{appendChild(){}}},alert:message=>alerts.push(message)});
  const tree = SalesReportTab({salesReport:{summary:{},transactions:[{transaction_number:'PAGE-ONLY'}]}});
  const buttons = nodes(tree).filter(n=>n.type==='button');
  const print = buttons.find(n=>nodes(n).some(child=>child.props?.children==='Print Report'));
  const excel = buttons.find(n=>nodes(n).some(child=>child.props?.children==='Export Excel (.xlsx)'));
  await print.props.onClick();
  assert.equal(requests[0].paginate,false);
  assert.equal(requests[0].page,undefined);
  assert.equal(requests[0].search,'Customer');
  assert.equal(requests[0].sort_by,'amount');
  assert.equal(requests[0].start_date,'2026-10-01');
  assert.match(output,/ORDER-25/);
  assert.match(output,/25 matching records/);
  assert.doesNotMatch(output,/PAGE-ONLY|Page 3 of/);
  await excel.props.onClick();
  assert.equal(exports[0].reportData,undefined);
  assert.equal(exports[0].filters.search,'Customer');
  assert.equal(exports[0].filters.page,undefined);
  assert.deepEqual(alerts,[]);
});
