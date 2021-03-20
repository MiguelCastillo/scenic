export const config = {
  "resources": [{
    "file": "/resources/obj/cube.obj",
  }, {
    "file": "/resources/obj/sphere.obj",
  }, {
    "file": "/resources/obj/torus-knot.obj",
  }],
  "items": [
    {
      "name": "world matrix",
      "type": "transform",
      "transform": {
        "scale": [1, 1, 1],
        "position": [0, 0, -20],
        "rotation": [0, 0, 0],
      },
      "items": [
        {
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
            "position": [-15, 0, 3],
            "rotation": [0, 0, 0],
          },
        }, {
          "name": "light-magenta",
          "type": "light",
          "resource": "/resources/obj/sphere.obj",

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
          "resource": "/resources/obj/sphere.obj",

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
