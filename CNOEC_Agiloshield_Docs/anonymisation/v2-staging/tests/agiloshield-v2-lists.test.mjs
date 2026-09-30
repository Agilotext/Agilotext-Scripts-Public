import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {emptyLists, addTerms, validateLists, termKey, loadStoredLists,
  saveStoredLists, clearStoredLists} from '../agiloshield-v2-lists.js';

assert.deepEqual(emptyLists(),{anon2InclusionList:[],anon2ExclusionList:[]});
assert.equal(termKey('École-des Mines'),termKey('ecole des mines'));
assert.deepEqual(addTerms([], 'Florian\nJean Dupont', 'inclure'),['Florian','Jean Dupont']);
assert.deepEqual(addTerms([], 'Nom, prénom', 'inclure'),['Nom, prénom']);
assert.throws(()=>addTerms(['École'], 'ecole', 'inclure'),/déjà/);
assert.throws(()=>addTerms([], 'x\u0000y', 'inclure'),/contrôle/);
assert.throws(()=>addTerms([], 'x'.repeat(257), 'inclure'),/256/);
assert.throws(()=>addTerms(Array.from({length:100},(_,i)=>'terme'+i),
  'un autre','inclure'),/100/);
assert.throws(()=>validateLists({anon2InclusionList:[''],anon2ExclusionList:[]}),
  /invalide/);
assert.throws(()=>validateLists({anon2InclusionList:['a\nb'],anon2ExclusionList:[]}),
  /invalide/);
assert.deepEqual(validateLists({anon2InclusionList:[],anon2ExclusionList:[]}),emptyLists());

const values=new Map();
const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),
  removeItem:key=>values.delete(key)};
const opts={storage,cryptoImpl:webcrypto};
const lists={anon2InclusionList:['Florian'],anon2ExclusionList:['Exemple']};
assert.equal(await saveStoredLists('account-A',lists,opts),true);
assert.deepEqual((await loadStoredLists('account-A',opts)).lists,lists);
assert.deepEqual((await loadStoredLists('account-B',opts)).lists,emptyLists());
assert.ok([...values.keys()].every(key=>!key.includes('account-A')));
assert.equal(await clearStoredLists('account-A',opts),true);
assert.deepEqual((await loadStoredLists('account-A',opts)).lists,emptyLists());
const denied={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
assert.equal((await loadStoredLists('account-A',{...opts,storage:denied})).persistent,false);
assert.equal(await saveStoredLists('account-A',lists,{...opts,storage:denied}),false);
console.log('List UI helper tests passed');
