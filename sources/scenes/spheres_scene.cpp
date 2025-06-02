#include "spheres_scene.h"

SpheresScene::SpheresScene()
	: Scene(), pathTracerShader(nullptr), quadVAO(nullptr), quadVBO(nullptr), quadIBO(nullptr)
{
}

void SpheresScene::setup()
{
	float vertices[] = {
		-1.0f, -1.0f,
		 1.0f, -1.0f,
		 1.0f,  1.0f,
		-1.0f,  1.0f
	};

	unsigned int indices[] = {
		0, 1, 2,
		2, 3, 0
	};

	pathTracerShader = new ShaderProgram("sources/shaders/path_tracer.vert", "sources/shaders/path_tracer.frag");

	pathTracerShader->bind();

	// Sphere 0.
	pathTracerShader->setUniform3f("uSpheres[0].center", glm::vec3(0.0f, 0.0f, -5.0f));
	pathTracerShader->setUniform1f("uSpheres[0].radius", 1.0f);
	pathTracerShader->setUniform3f("uSpheres[0].material.albedo", glm::vec3(1.0f, 0.0f, 0.0f)); // Red.
	pathTracerShader->setUniform1f("uSpheres[0].material.reflectivity", 0.3f); // Slightly reflective.
	pathTracerShader->setUniform3f("uSpheres[0].material.emission", glm::vec3(0.0f, 0.0f, 0.0f));

	// Sphere 1 (e.g., a reflective sphere).
	pathTracerShader->setUniform3f("uSpheres[1].center", glm::vec3(2.0f, 0.5f, -4.0f));
	pathTracerShader->setUniform1f("uSpheres[1].radius", 0.5f);
	pathTracerShader->setUniform3f("uSpheres[1].material.albedo", glm::vec3(0.8f, 0.8f, 0.8f)); // Silver.
	pathTracerShader->setUniform1f("uSpheres[1].material.reflectivity", 0.9f); // Highly reflective.
	pathTracerShader->setUniform3f("uSpheres[1].material.emission", glm::vec3(0.0f, 0.0f, 0.0f));

	pathTracerShader->unbind();

	quadVAO = new VAO();
	quadVBO = new VBO(vertices, sizeof(vertices));
	quadIBO = new IBO(indices, sizeof(indices));

	quadVAO->bind();
	quadVBO->bind();
	quadIBO->bind();

	quadVAO->setVertexAttribute(0, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), (void*)(0));

	quadVAO->unbind(); // Unbind VAO before another buffer.
	quadVBO->unbind();
	quadIBO->unbind();
}

void SpheresScene::clean()
{
	pathTracerShader->clean();

	quadVBO->clean();
	quadVAO->clean();
	quadIBO->clean();
}

void SpheresScene::update(float deltaTime)
{
}

void SpheresScene::render(const Camera& camera, float deltaTime)
{
	pathTracerShader->bind();
	quadVAO->bind();

	pathTracerShader->setUniform3f("uCameraPosition", camera.getPosition());
	pathTracerShader->setUniformMatrix4fv("uInverseProjectionMatrix", glm::inverse(camera.getProjectionMatrix()));
	pathTracerShader->setUniformMatrix4fv("uInverseViewMatrix", glm::inverse(camera.getViewMatrix()));

	glClearColor(0.75f, 0.75f, 0.75f, 1.0f);
	glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

	glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);

	quadVAO->unbind();
	pathTracerShader->unbind();
}

void SpheresScene::processGUI()
{
}
