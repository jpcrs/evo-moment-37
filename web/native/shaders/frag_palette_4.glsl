#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

uniform sampler2D uPalette;
uniform usampler2D uIndexTex;
uniform ivec2 uTextureSize;

in vec4 vColor;
in vec2 vTexCoord;
out vec4 FragColor;

uint fetch4bppIndex(vec2 uv) {
    ivec2 pixelCoord = ivec2(
        int(uv.x * float(uTextureSize.x)),
        int(uv.y * float(uTextureSize.y))
    );

    int packedX = pixelCoord.x / 2;
    uint packedTexel = texelFetch(uIndexTex, ivec2(packedX, pixelCoord.y), 0).r;
    return ((pixelCoord.x & 1) == 0) ? (packedTexel & 0xFu) : ((packedTexel >> 4) & 0xFu);
}

void main() {
    uint index = fetch4bppIndex(vTexCoord);
    vec4 color = texelFetch(uPalette, ivec2(int(index),0), 0);
    FragColor = color * vColor;

	if (FragColor.a == 0.0) {
		discard;
	}
}
