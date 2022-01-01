export const config = {
  "preload": {
    "shaders": ["phong-lighting","phong-texture","flat-material",]
  },
  "items": [
    {
      "name": "axis projection",
      "type": "orthographic",

      "projection": {
        "far": 1000,
      },

      "transform": {
        "scale": [30, 30, 30],
        "position": [100, 100, 0],
        "rotation": [0, 0, 0],
      },
      "items": [
        {
          "name": "axis-x",
          "type": "static-mesh",
          "resource": "/resources/obj/axis.obj",

          "material": {
            "color": [1, 0, 0, 1],
            "reflectiveness": 0,
          },

          "ambient": {
            "color": [1, 0, 0],
          },

          "transform": {
            "scale": [1, 1, 1],
            "position": [0, 0, 0],
            "rotation": [0, 0, 0],
          },
        }, {
          "name": "axis-y",
          "type": "static-mesh",
          "resource": "/resources/obj/axis.obj",

          "material": {
            "color": [0, 1, 0, 1],
            "reflectiveness": 0,
          },

          "ambient": {
            "color": [0, 1, 0],
          },

          "transform": {
            "scale": [1, 1, 1],
            "position": [0, 0, 0],
            "rotation": [0, 0, 90],
          },
        }, {
          "name": "axis-z",
          "type": "static-mesh",
          "resource": "/resources/obj/axis.obj",

          "material": {
            "color": [0, 0, 1, 1],
            "reflectiveness": 0,
          },

          "ambient": {
            "color": [0, 0, 1],
          },

          "transform": {
            "scale": [1, 1, 1],
            "position": [0, 0, 0],
            "rotation": [0, -90, 0],
          },
        },
      ]
    },
    {
      "name": "world projection",
      "type": "perspective",

      "projection": {
        "near": 1,
        "far": 1000,
        "fov": 90,
      },

      "transform": {
        "scale": [1, 1, 1],
        "position": [0, 0, -20],
        "rotation": [0, 0, 0],
      },

      "items": [
        {
          "name": "light-white",
          "type": "light",
          "resource": "/resources/obj/sphere.obj",

          "light": {
            "intensity": 1,
            "color": [1, 1, 1],
          },

          "material": {
            "color": [1, 1, 1, 1],
            "reflectiveness": 1,
          },

          "transform": {
            "scale": [1, 1, 1],
            "position": [0, 20, 10],
            "rotation": [0, 0, 0],
          },
        }, {
          "name": "light-cyan",
          "type": "light",
          "resource": "/resources/obj/sphere.obj",

          "light": {
            "color": [0, 1, 1],
            "intensity": 0.5,
          },

          "material": {
            "color": [0, 1, 1, 1],
            "reflectiveness": 1,
          },

          "transform": {
            "scale": [1, 1, 1],
            "position": [-35, 5, 0],
            "rotation": [0, 0, 0],
          },
        }, {
          "name": "light-magenta",
          "type": "light",
          "resource": "/resources/obj/sphere.obj",

          "light": {
            "intensity": 0.5,
            "color": [1, 0, 1],
          },

          "material": {
            "color": [1, 0, 1, 1],
            "reflectiveness": 1,
          },

          "transform": {
            "scale": [1, 1, 1],
            "position": [35, 5, 0],
            "rotation": [0, 0, 0],
          },
        }, {
          "name": "scene objects",
          "type": "transform",
        
          "transform": {
            "scale": [1, 1, 1],
            "position": [0, 0, 0],
            "rotation": [0, 0, 0],
          },

          "items": [{
            "name": "jedi star fighter",
            "type": "static-mesh",
            "resource": "/resources/fbx/JediStarFighter.fbx",
            "material": {
              "color": [1, 1, 1, 1],
              "reflectiveness": 1,
              "bumpLighting": true,

              // TODO(miguel): also add support for pattern matching.
              "textures": [{
                "name": "mainMat_nrm.png",
                "type": "normalmap",
              }, {
                "name": "auxielieryMat_nrm.png",
                "type": "normalmap",
              }],
            },
            "transform": {
              "scale": [1, 1, 1],
              "position": [0, 0, 0],
              "rotation": [0, 0, 0],
            },
          }],
        },
      ]
    }
  ]
};
