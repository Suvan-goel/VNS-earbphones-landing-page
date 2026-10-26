"""Convert the sculpture's connected fibre silhouettes to smooth graph paths."""
import json
from pathlib import Path
import cv2
import numpy as np
from scipy import ndimage

OUT=Path(__file__).parent
result={}
neighbours=[(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
for sign in [-1,1]:
    image=cv2.imread(str(OUT/f'core-mask-{sign}.png'),cv2.IMREAD_GRAYSCALE)
    image=cv2.GaussianBlur(image,(5,5),.85)
    mask=(image>60).astype(np.uint8)*255
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
    mask=cv2.morphologyEx(mask,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
    count,labels,stats,_=cv2.connectedComponentsWithStats(mask,8)
    largest=1+np.argmax(stats[1:,cv2.CC_STAT_AREA])
    mask=(labels==largest).astype(np.uint8)*255
    mask=ndimage.binary_fill_holes(mask>0).astype(np.uint8)*255
    widths=cv2.distanceTransform(mask,cv2.DIST_L2,5)
    skeleton=cv2.ximgproc.thinning(mask)>0
    degree=ndimage.convolve(skeleton.astype(int),np.ones((3,3),dtype=int),mode='constant')-skeleton
    critical=skeleton&(degree!=2)
    nodes,node_count=ndimage.label(critical,np.ones((3,3)))
    centres=ndimage.center_of_mass(critical,nodes,range(1,node_count+1))
    centre={i+1:np.array(c) for i,c in enumerate(centres)}
    endpoints={i for i in centre if np.max(degree[nodes==i])==1}
    h,w=skeleton.shape
    def adjacent(p):
        y,x=p
        return [(y+dy,x+dx) for dy,dx in neighbours if 0<=y+dy<h and 0<=x+dx<w and skeleton[y+dy,x+dx]]
    visited=set();paths=[]
    for y,x in zip(*np.nonzero(critical)):
        start=(int(y),int(x));node=int(nodes[start])
        for following in adjacent(start):
            if nodes[following] or (start,following) in visited:continue
            chain=[centre[node]];previous=start;current=following
            while True:
                visited.add((previous,current));visited.add((current,previous))
                chain.append(np.array(current,dtype=float))
                end_node=int(nodes[current])
                if end_node:
                    chain[-1]=centre[end_node]
                    break
                onward=[p for p in adjacent(current) if p!=previous]
                if not onward:break
                previous,current=current,onward[0]
            if node==end_node or (len(chain)<12 and (node in endpoints or end_node in endpoints)):continue
            path=np.array(chain)
            # Retain graph junctions exactly; smooth only the path between them.
            smooth=ndimage.gaussian_filter1d(path,2,axis=0,mode='nearest')
            smooth[0]=path[0];smooth[-1]=path[-1]
            indices=np.r_[np.arange(0,len(smooth)-1,3),len(smooth)-1]
            path=smooth[indices]
            yy=np.clip(np.round(path[:,0]).astype(int),0,h-1);xx=np.clip(np.round(path[:,1]).astype(int),0,w-1)
            radius=np.clip(widths[yy,xx]*3.0/1200*.60,.0033,.011)
            if node in endpoints:radius[:min(5,len(radius))]*=np.linspace(.18,1,min(5,len(radius)))
            if end_node in endpoints:radius[-min(5,len(radius)):]*=np.linspace(1,.18,min(5,len(radius)))
            paths.append({'pixels':path[:,::-1].tolist(),'radius':radius.tolist()})
    result[str(sign)]={'paths':paths,'rootPixel':max([centre[i] for i in endpoints],key=lambda p:p[0])[::-1].tolist()}
    print(sign,'paths',len(paths),'maskPixels',int((mask>0).sum()))
(OUT/'traced-fibre-paths.json').write_text(json.dumps(result,separators=(',',':')))
