#include "view.h"
#include <sstream>
#include <math.h>
#include "modelio.h"

using namespace std;

int main() {
  double frames = 45;
  
  for (int i = 0; i < frames; i++) {

    model scene;
  
    model *station = loadASEModel("../models/station.ase");
    scene.addItem(new modelRotate3Dz((i / frames) * 2 * 3.1415926));
    scene.addItem(station);
  
    model *xwing = loadASEModel("../models/xwing.ase");
    scene.addItem(new modelScale3D(.2));  
    scene.addItem(new modelTranslate3D(200, 0, 0));
    scene.addItem(new modelRotate3Dz((i / frames) * 2 * 3.1415926));
    scene.addItem(xwing);

    model *ship = loadASEModel("../models/attackship.ase");
    scene.addItem(new modelMatrixReset());
    scene.addItem(new modelScale3D(.2));  
    scene.addItem(new modelTranslate3D(-200, 0, 0));
    scene.addItem(new modelRotate3Dz((i / frames) * 2 * 3.1415926));
    scene.addItem(ship);

    model *tie = loadASEModel("../models/tfighter.ase");
    scene.addItem(new modelMatrixReset());
    scene.addItem(new modelScale3D(.2));    
    scene.addItem(new modelTranslate3D(0, -200, 0));
    scene.addItem(new modelRotate3Dz((i / frames) * 2 * 3.1415926));
    scene.addItem(tie);

    model *bee = loadASEModel("../models/bee.ase");
    scene.addItem(new modelMatrixReset());
    scene.addItem(new modelRotate3Dz(-3.1415926 / 2));
    scene.addItem(new modelScale3D(.2));    
    scene.addItem(new modelTranslate3D(0, 200, 0));
    scene.addItem(new modelRotate3Dz((i / frames) * 2 * 3.1415926));
    scene.addItem(bee);

    scene.addItem(new modelMatrixReset());
    scene.addItem(new modelTranslate3D(0, 800, 0));
    scene.addItem(new pointLight(colorVector(1, 1, 1)));
    scene.addItem(new sunLight(colorVector(1, 1, 1), vector3D(0, 0, -1)));

    image im = image(600, 600, Pixel(255, 255, 255));
    view3D v;
    v.setCamera(point3D(800, 800, 800), point3D(-1, -1, -1), point3D(0, 0, 1));
    v.setProjectionDistance(800);
    v.setCameraSize(200, 200);
    v.setClipPlanes(0, 3);
    v.setAmbientLight(colorVector(75/255.0, 75/255.0, 75/255.0));
    v.project(scene, im);

    ostringstream osData;
    osData.width(2);
    osData.fill('0');
    osData.setf(ios::right, ios::adjustfield);
    osData << i;
  
    im.writeImage("../images/spacetron/" + osData.str() + ".ppm");
  }
}
