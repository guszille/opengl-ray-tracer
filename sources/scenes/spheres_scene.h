#pragma once

#include "../graphics/shader.h"
#include "../graphics/buffer.h"
#include "../scene.h"
#include "../utils/common.h"

struct Material
{
	int type;

	glm::vec3 albedo, emission;

	float roughness, indexOfRefraction;
};

struct Sphere
{
	glm::vec3 center;

	float radius;

	Material material;
};

struct PointLight
{
	glm::vec3 position, color;

	float radius, power;
};

struct SpheresSceneUniforms
{
	float time;

	glm::vec3 skyColor;
		
	int maxBounces, samplesPerPixel;

	PointLight lights[1];
};

class SpheresScene : public Scene
{
public:
	SpheresScene();

	void setup();
	void clean();

	void update(float deltaTime);
	void render(const Camera& camera, float deltaTime);

	void processGUI();

private:
	ShaderProgram* pathTracerShader;

	VAO* quadVAO;
	VBO* quadVBO;
	IBO* quadIBO;

	SpheresSceneUniforms uniforms;
};
