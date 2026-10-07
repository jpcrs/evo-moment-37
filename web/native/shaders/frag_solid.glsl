#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

in vec4 vColor;
in vec2 vTexCoord;
out vec4 FragColor;

void main() {
    FragColor = vColor;
}
