#pragma once

#include <glm/glm.hpp>

#include <imgui/imgui.h>

#include "camera.h"

enum class SceneTypes
{
	SPHERES
};

class Scene
{
public:
	Scene() = default;

	virtual void setup() = 0;
	virtual void clean() = 0;

	virtual void update(float deltaTime) = 0;
	virtual void render(const Camera& camera, float deltaTime) = 0;

	virtual void processGUI() = 0;
};
