#pragma once

#include <cmath>

#include <glm/glm.hpp>

inline float randomNumber()
{
	return float(std::rand() / (RAND_MAX + 1.0)); // Returns a random real in [0, 1).
}

inline float randomNumber(float min, float max)
{
	return min + (max - min) * randomNumber(); // Returns a random real in [min, max).
}

inline glm::vec3 randomVec3()
{
	return glm::vec3(randomNumber(), randomNumber(), randomNumber());
}

inline glm::vec3 randomVec3(float min, float max)
{
	return glm::vec3(randomNumber(min, max), randomNumber(min, max), randomNumber(min, max));
}
