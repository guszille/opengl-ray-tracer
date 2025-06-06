#include "spheres_scene.h"

SpheresScene::SpheresScene()
	: Scene(), pathTracerShader(nullptr), quadVAO(nullptr), quadVBO(nullptr), quadIBO(nullptr),
	  uniforms({ 0.0f, glm::vec3(0.5f, 0.7f, 1.0f), 64 })
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

	// Sphere 0 (lambertian, ground).
	pathTracerShader->setUniform3f("uSpheres[0].center", glm::vec3(0.0f, -1000.0f, 0.0f));
	pathTracerShader->setUniform1f("uSpheres[0].radius", 1000.0f);
	pathTracerShader->setUniform1i("uSpheres[0].material.type", 0);
	pathTracerShader->setUniform3f("uSpheres[0].material.albedo", glm::vec3(0.5f, 0.5f, 0.5f));
	pathTracerShader->setUniform3f("uSpheres[0].material.emission", glm::vec3(0.0f, 0.0f, 0.0f));

	// Sphere 1 (dielectric).
	pathTracerShader->setUniform3f("uSpheres[1].center", glm::vec3(0.0f, 1.0f, 0.0f));
	pathTracerShader->setUniform1f("uSpheres[1].radius", 1.0f);
	pathTracerShader->setUniform1i("uSpheres[1].material.type", 2);
	pathTracerShader->setUniform1f("uSpheres[1].material.indexOfRefraction", 1.5f);
	pathTracerShader->setUniform3f("uSpheres[1].material.emission", glm::vec3(0.0f, 0.0f, 0.0f));

	// Sphere 2 (lambertian).
	pathTracerShader->setUniform3f("uSpheres[2].center", glm::vec3(-4.0f, 1.0f, 0.0f));
	pathTracerShader->setUniform1f("uSpheres[2].radius", 1.0f);
	pathTracerShader->setUniform1i("uSpheres[2].material.type", 0);
	pathTracerShader->setUniform3f("uSpheres[2].material.albedo", glm::vec3(0.4f, 0.2f, 0.1f));
	pathTracerShader->setUniform3f("uSpheres[2].material.emission", glm::vec3(0.0f, 0.0f, 0.0f));

	// Sphere 3 (metal).
	pathTracerShader->setUniform3f("uSpheres[3].center", glm::vec3(4.0f, 1.0f, 0.0f));
	pathTracerShader->setUniform1f("uSpheres[3].radius", 1.0f);
	pathTracerShader->setUniform1i("uSpheres[3].material.type", 1);
	pathTracerShader->setUniform1f("uSpheres[3].material.fuzz", 0.0f);
	pathTracerShader->setUniform3f("uSpheres[3].material.albedo", glm::vec3(0.7f, 0.6f, 0.5f));
	pathTracerShader->setUniform3f("uSpheres[3].material.emission", glm::vec3(0.0f, 0.0f, 0.0f));

	int i = 4;

	for (int a = -4; a < 4; a++)
	{
		for (int b = -4; b < 4; b++)
		{
			float material = randomNumber();
			glm::vec3 center(a + 0.9f * randomNumber(), 0.2f, b + 0.9f * randomNumber());

			if (material < 0.8f) // Lambertian.
			{
				glm::vec3 albedo = randomVec3() * randomVec3();

				pathTracerShader->setUniform3f(("uSpheres[" + std::to_string(i) + "].center").c_str(), center);
				pathTracerShader->setUniform1f(("uSpheres[" + std::to_string(i) + "].radius").c_str(), 0.2f);
				pathTracerShader->setUniform1i(("uSpheres[" + std::to_string(i) + "].material.type").c_str(), 0);
				pathTracerShader->setUniform3f(("uSpheres[" + std::to_string(i) + "].material.albedo").c_str(), albedo);
				pathTracerShader->setUniform3f(("uSpheres[" + std::to_string(i) + "].material.emission").c_str(), glm::vec3(0.0f, 0.0f, 0.0f));
			}
			else if (material < 0.95f) // Metal.
			{
				glm::vec3 albedo = randomVec3(0.5f, 1.0f);
				float fuzz = randomNumber(0.0f, 0.5f);

				pathTracerShader->setUniform3f(("uSpheres[" + std::to_string(i) + "].center").c_str(), center);
				pathTracerShader->setUniform1f(("uSpheres[" + std::to_string(i) + "].radius").c_str(), 0.2f);
				pathTracerShader->setUniform1i(("uSpheres[" + std::to_string(i) + "].material.type").c_str(), 1);
				pathTracerShader->setUniform1f(("uSpheres[" + std::to_string(i) + "].material.fuzz").c_str(), fuzz);
				pathTracerShader->setUniform3f(("uSpheres[" + std::to_string(i) + "].material.albedo").c_str(), albedo);
				pathTracerShader->setUniform3f(("uSpheres[" + std::to_string(i) + "].material.emission").c_str(), glm::vec3(0.0f, 0.0f, 0.0f));
			}
			else // Dielectric.
			{
				pathTracerShader->setUniform3f(("uSpheres[" + std::to_string(i) + "].center").c_str(), center);
				pathTracerShader->setUniform1f(("uSpheres[" + std::to_string(i) + "].radius").c_str(), 0.2f);
				pathTracerShader->setUniform1i(("uSpheres[" + std::to_string(i) + "].material.type").c_str(), 2);
				pathTracerShader->setUniform1f(("uSpheres[" + std::to_string(i) + "].material.indexOfRefraction").c_str(), 1.5f);
				pathTracerShader->setUniform3f(("uSpheres[" + std::to_string(i) + "].material.emission").c_str(), glm::vec3(0.0f, 0.0f, 0.0f));
			}

			i++;
		}
	}

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
	uniforms.time += deltaTime;
}

void SpheresScene::render(const Camera& camera, float deltaTime)
{
	pathTracerShader->bind();
	quadVAO->bind();

	pathTracerShader->setUniform3f("uCameraPosition", camera.getPosition());
	pathTracerShader->setUniformMatrix4fv("uInverseProjectionMatrix", glm::inverse(camera.getProjectionMatrix()));
	pathTracerShader->setUniformMatrix4fv("uInverseViewMatrix", glm::inverse(camera.getViewMatrix()));

	pathTracerShader->setUniform3f("uSkyColor", uniforms.skyColor);
	pathTracerShader->setUniform1i("uMaxBounces", uniforms.maxBounces);

	glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
	glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

	glDrawElements(GL_TRIANGLES, 6, GL_UNSIGNED_INT, 0);

	quadVAO->unbind();
	pathTracerShader->unbind();
}

void SpheresScene::processGUI()
{
	bool dialogOpen = true;
	ImGui::Begin("Spheres Scene", &dialogOpen, ImGuiWindowFlags_MenuBar);

	ImGui::ColorEdit3("Sky Color", glm::value_ptr(uniforms.skyColor));
	ImGui::DragInt("Max Bounces", &uniforms.maxBounces, 1, 1, 128);

	ImGui::End();
}
