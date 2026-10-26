"""Regenerate the spec-traceable concept assembly. Requires FreeCAD Python modules."""
from pathlib import Path
import sys,time,faulthandler
sys.path.insert(0,str(Path(__file__).parent))
faulthandler.enable();faulthandler.dump_traceback_later(120,repeat=True)
from common import *
from earbuds import build_bud,build_fit_kit
from hub import build_hub
from cables import build_cables,build_cable_section
from export_model import export_all
from refine_cable_meshes import refine
out=Path(__file__).resolve().parent.parent
metrics={}
t=time.time()
metrics['left']=build_bud('L');metrics['right']=build_bud('R')
metrics['hub']=build_hub()
metrics['cables']=build_cables(tuple(metrics['hub']['connector_cable_exit_mm']))
build_fit_kit();build_cable_section()
export_all(out,metrics)
refine(out)
print('Elapsed',round(time.time()-t,1),'seconds',flush=True)
