export const config = {
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
          "name": "light-cyan",
          "type": "light",
          "resource": "/resources/fbx/sphere.fbx",

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
            "position": [-15, 0, 3],
            "rotation": [0, 0, 0],
          },
        }, {
          "name": "light-magenta",
          "type": "light",
          "resource": "/resources/fbx/sphere.fbx",

          "light": {
            "color": [1, 0, 1],
            "intensity": 0.5,
          },

          "material": {
            "color": [1, 0, 1, 1],
            "reflectiveness": 1,
          },

          "transform": {
            "scale": [1, 1, 1],
            "position": [15, 0, 3],
            "rotation": [0, 0, 0],
          },
        }, {
          "name": "light-yellow",
          "type": "light",
          "resource": "/resources/fbx/sphere.fbx",

          "light": {
            "intensity": 0.75,
            "color": [1, 1, 0],
          },

          "material": {
            "color": [1, 1, 0, 1],
            "reflectiveness": 1,
          },

          "transform": {
            "scale": [1, 1, 1],
            "position": [-15, 0, 3],
            "rotation": [0, 0, 0],
          },
        }, {
          "name": "group-1",
          "type": "transform",
          "transform": {
            "scale": [1, 1, 1],
            "position": [0, 0, 0],
            "rotation": [0, 0, 0],
          },
          "items": [
            {
              "name": "torus knot",
              "type": "static-mesh",
              "resource": "/resources/obj/torus-knot.obj",
              "material": {
                "color": [1, 1, 1, 1],
                "reflectiveness": 1,
              },
              "transform": {
                "scale": [1, 1, 1],
                "position": [0, 0, 0],
                "rotation": [0, 0, 0],
              },
            },
          ]
        }
      ]
    }
  ]
};
