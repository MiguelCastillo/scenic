import {
  getTriangleComponents,
} from "./geometry.js";

test("getTriangleComponents", () => {
  const vertices = [
    1, 1, 1,    // coord 0
    1, 1, -1,   // coord 1
    1, -1, 1,   // coord 2
    1, -1, -1,  // coord 3
    -1, 1, 1,   // coord 4
    -1, 1, -1,  // coord 5
    -1, -1, 1,  // coord 6
    -1, -1, -1, // coord 7
  ];

  const indexes = [
    0, 4, 6, // vert 0
    0, 6, 2, // vert 1
    3, 2, 6, // vert 2
    3, 6, 7, // vert 3
    7, 6, 4, // vert 4
    7, 4, 5, // vert 5
    5, 1, 3, // vert 6
    5, 3, 7, // vert 7
    1, 0, 2, // vert 8
    1, 2, 3, // vert 9
    5, 4, 0, // vert 10
    5, 0, 1, // vert 11
  ]

  expect(getTriangleComponents(vertices, indexes)).toEqual([
    1, 1, 1,    // coord 0 |
    -1, 1, 1,   // coord 4 | vert 0
    -1, -1, 1,  // coord 6 |

    1, 1, 1,    // coord 0 |
    -1, -1, 1,  // coord 6 | vert 1
    1, -1, 1,   // coord 2 |

    1, -1, -1,  // coord 3 |
    1, -1, 1,   // coord 2 | vert 2
    -1, -1, 1,  // coord 6 |

    1, -1, -1,  // coord 3 |
    -1, -1, 1,  // coord 6 | vert 3
    -1, -1, -1, // coord 7 |

    -1, -1, -1, // coord 7 |
    -1, -1, 1,  // coord 6 | vert 4
    -1, 1, 1,   // coord 4 |

    -1, -1, -1, // coord 7 |
    -1, 1, 1,   // coord 4 | vert 5
    -1, 1, -1,  // coord 5 |

    -1, 1, -1,  // coord 5 |
    1, 1, -1,   // coord 1 | vert 6
    1, -1, -1,  // coord 3 |

    -1, 1, -1,  // coord 5 |
    1, -1, -1,  // coord 3 | vert 7
    -1, -1, -1, // coord 7 |

    1, 1, -1,   // coord 1 |
    1, 1, 1,    // coord 0 | vert 8
    1, -1, 1,   // coord 2 |

    1, 1, -1,   // coord 1 |
    1, -1, 1,   // coord 2 | vert 9
    1, -1, -1,  // coord 3 |

    -1, 1, -1,  // coord 5 |
    -1, 1, 1,   // coord 4 | vert 10
    1, 1, 1,    // coord 0 |

    -1, 1, -1,  // coord 5 |
    1, 1, 1,    // coord 0 | vert 11
    1, 1, -1,   // coord 1 |
  ]);
});
