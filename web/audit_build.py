"""Inspect WebAssembly's function-name section and the packed-resource manifest."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
blob=(ROOT/'dist/engine.wasm').read_bytes()
def num(data,pos):
 n=0;shift=0
 while True:
  v=data[pos];pos+=1;n|=(v&127)<<shift
  if not v&128:return n,pos
  shift+=7
def string(data,pos):
 n,pos=num(data,pos);return data[pos:pos+n].decode('utf8'),pos+n
names=[];i=8
while i<len(blob):
 section=blob[i];size,start=num(blob,i+1);end=start+size
 if section==0:
  title,at=string(blob,start)
  if title=='name':
   while at<end:
    kind=blob[at];length,sub=num(blob,at+1);finish=sub+length
    if kind==1:
     count,sub=num(blob,sub)
     for _ in range(count):
      ix,sub=num(blob,sub);name,sub=string(blob,sub);names.append(name)
    at=finish
 i=end
if not names:
 names=[line.split(':',1)[1].strip() for line in (ROOT/'build/engine.symbols').read_text().splitlines() if ':' in line]
forbidden=('Select_Player','TITLE_Move','Title_At_a_Dash','Loop_Demo','Opening','Ending','Game00','Game01','Game03','Game12','Menu_Task')
found=[n for n in names if any(n.startswith(v)for v in forbidden)]
print(json.dumps({'wasm_bytes':len(blob),'data_bytes':(ROOT/'dist/engine.data').stat().st_size,'function_count':len(names),'non_scene_functions':found},indent=2))
(ROOT/'build/function-names.json').write_text(json.dumps(names,indent=2)+'\n')

assert not found, f'Non-scene routines remain: {found}'
resources=json.loads((ROOT/'assets/manifest.json').read_text())['resources']
for resource in resources:
 assert not any(word in resource['name'] for word in ['Title','Warning','CapLogo','menu','P_Sel']), resource['name']
