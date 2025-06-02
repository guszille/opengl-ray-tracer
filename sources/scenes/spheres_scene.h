#pragma once

#include "../graphics/shader.h"
#include "../graphics/buffer.h"
#include "../scene.h"

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
};
