#version 460 core

out vec4 FragColor;

struct Ray
{
    vec3 origin, direction;
};

struct Material
{
    /* Acceptable types:
     *
     *  0: LAMBERTIAN;
     *  1: METAL;
     *  2: DIELECTRIC.
     */
    int type;

    vec3 albedo, emission;

    float fuzz, indexOfRefraction;
};

struct Sphere
{
    vec3 center;

    float radius;

    Material material;
};

struct HitRecord
{
    vec3 point, normal;

    float t;

    Material material;

    bool frontFace;
};

const int NUM_SPHERES = 64 + 4;
const float EPSILON = 0.001;
const float MAX_DISTANCE = 1000.0; // Camera frustum distance.
const float PI = 3.14159265359;

uniform vec3 uCameraPosition;
uniform mat4 uInverseProjectionMatrix; // To unproject screen coordinates.
uniform mat4 uInverseViewMatrix; // To transform from camera to world space.
uniform vec2 uViewportSize = vec2(1600, 900); // Dimensions of the viewport (e.g., window width, window height).
uniform vec3 uSkyColor = vec3(0.5, 0.7, 1.0); // Background color.
uniform int uMaxBounces = 8; // Max number of ray bounces.
uniform int uSamples = 16; // Number of samples per pixel.
uniform Sphere uSpheres[NUM_SPHERES];
// uniform float uTime;

float random(vec2 seed)
{
    return fract(sin(dot(seed, vec2(12.9898, 78.2330))) * 43758.5453123);
}

vec3 randomInUnitSphere(vec2 seed)
{
    float r1 = random(seed);
    float r2 = random(seed + vec2(0.1, 0.1));
    float phi = 2.0 * PI * r1;
    float cosTheta = 2.0 * r2 - 1.0;
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

    return vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
}

void setHitRecordFaceNormal(in Ray r, in vec3 outwardNormal, inout HitRecord rec)
{
    rec.frontFace = dot(r.direction, outwardNormal) < 0;
    rec.normal = rec.frontFace ? outwardNormal : -outwardNormal;
}

bool sphereHit(in Ray r, in Sphere s, in float tMin, in float tMax, inout HitRecord rec)
{
    vec3 oc = r.origin - s.center;

    float a = dot(r.direction, r.direction);
    float b = dot(oc, r.direction);
    float c = dot(oc, oc) - s.radius * s.radius;
    float discriminant = b * b - a * c;
    float root;

    if (discriminant >= 0.0)
    {
        root = (-b - sqrt(discriminant)) / a;

        if (root < tMax && root > tMin)
        {
            rec.t = root;
            rec.point = r.origin + r.direction * rec.t;
            rec.material = s.material;

            setHitRecordFaceNormal(r, (rec.point - s.center) / s.radius, rec);

            return true;
        }

        root = (-b + sqrt(discriminant)) / a;

        if (root < tMax && root > tMin)
        {
            rec.t = root;
            rec.point = r.origin + r.direction * rec.t;
            rec.material = s.material;

            setHitRecordFaceNormal(r, (rec.point - s.center) / s.radius, rec);

            return true;
        }
    }

    return false;
}

bool worldHit(in Ray r, in float tMin, in float tMax, inout HitRecord rec)
{
    bool hit = false;
    float closestSoFar = tMax;
    HitRecord closestRec;

    for (int i = 0; i < NUM_SPHERES; i++)
    {
        if(sphereHit(r, uSpheres[i], tMin, closestSoFar, closestRec))
        {
            hit = true;
            closestSoFar = closestRec.t;
            rec = closestRec;
        }
    }

    return hit;
}

float getMaterialReflectance(in float indexOfRefraction, in float cosTheta)
{
    // Use Schlick's approximation for reflectance.
    float r0 = pow((1.0 - indexOfRefraction) / (1.0 + indexOfRefraction), 2.0);

    return r0 + (1.0 - r0) * pow((1 - cosTheta), 5.0);
}

bool scatterLambertian(in Ray r, in HitRecord rec, out vec3 attenuation, out Ray scattered, in vec2 seed)
{
    vec3 scatterDirection = rec.normal + randomInUnitSphere(seed);

    if (length(scatterDirection) < EPSILON)
    {
        scatterDirection = rec.normal;
    }

    attenuation = rec.material.albedo;
    scattered = Ray(rec.point, scatterDirection);

    return true;
}

bool scatterMetal(in Ray r, in HitRecord rec, out vec3 attenuation, out Ray scattered, in vec2 seed)
{
    vec3 reflected = reflect(normalize(r.direction), rec.normal);
    vec3 scatterDirection = reflected + (rec.material.fuzz * randomInUnitSphere(seed));

    attenuation = rec.material.albedo;
    scattered = Ray(rec.point, scatterDirection);

    return dot(scattered.direction, rec.normal) > 0;
}

bool scatterDielectric(in Ray r, in HitRecord rec, out vec3 attenuation, out Ray scattered, in vec2 seed)
{
    vec3 normalizedDirection = normalize(r.direction);
    vec3 scatterDirection;
    bool cannotRefract = false;

    float cosTheta = min(dot(-normalizedDirection, rec.normal), 1.0);
    float sinTheta = sqrt(1.0 - cosTheta * cosTheta);
    float refractionRatio = rec.frontFace ? (1.0 / rec.material.indexOfRefraction) : rec.material.indexOfRefraction;
    float reflectance = getMaterialReflectance(rec.material.indexOfRefraction, cosTheta);

    cannotRefract = cannotRefract || refractionRatio * sinTheta > 1.0;
    cannotRefract = cannotRefract || reflectance > random(seed);

    if (cannotRefract)
    {
        scatterDirection = reflect(normalizedDirection, rec.normal);
    }
    else
    {
        scatterDirection = refract(normalizedDirection, rec.normal, refractionRatio);
    }

    attenuation = vec3(1.0);
    scattered = Ray(rec.point, scatterDirection);

    return true;
}

vec3 getColor(in Ray r, in vec2 seed)
{
    vec3 finalColor = vec3(1.0);

    for (int b = 0; b < uMaxBounces; b++)
    {
        HitRecord rec;

        if (worldHit(r, EPSILON, MAX_DISTANCE, rec))
        {
            vec3 attenuation;
            Ray scattered;

            seed += 0.1;

            // Add albedo and claculate the scatter direction.
            switch (rec.material.type)
            {
            case 0: // Lambertian material.
                if (scatterLambertian(r, rec, attenuation, scattered, seed))
                {
                    finalColor *= attenuation;
                    r = scattered;
                }
                else
                {
                    return vec3(0.0); // Never will get here.
                }
                break;

            case 1: // Metal material.
                if (scatterMetal(r, rec, attenuation, scattered, seed))
                {
                    finalColor *= attenuation;
                    r = scattered;
                }
                else
                {
                    return vec3(0.0);
                }
                break;

            case 2: // Dielectric material.
                if (scatterDielectric(r, rec, attenuation, scattered, seed))
                {
                    finalColor *= attenuation;
                    r = scattered;
                }
                else
                {
                    return vec3(0.0); // Never will get here.
                }
                break;

            default:
                break;
            }
        }
        else
        {
            float a = 0.5 * (normalize(r.direction).y + 1.0);

            // Ray missed all objects, add sky/background color.
            return finalColor * ((1.0 - a) * vec3(1.0) + a * uSkyColor);
        }
    }

    return vec3(0.0);
}

vec3 getRayDirection(vec2 offset)
{
    vec2 uv = (gl_FragCoord.xy - 0.5 * uViewportSize.xy) / uViewportSize.y; // Screen coordinates.

    vec3 u = normalize(vec3(uInverseViewMatrix[0])); // Right.
    vec3 v = normalize(vec3(uInverseViewMatrix[1])); // Up.
    vec3 w = normalize(vec3(uInverseViewMatrix[2])); // Forward.

    w = -w;

    return normalize((uv.x + offset.x) * u + (uv.y + offset.y) * v + 1.5 * w);
}

void main()
{
    vec2 uv = (gl_FragCoord.xy - 0.5 * uViewportSize.xy) / uViewportSize.y;
    vec3 color = vec3(0.0);

    for (int s = 0; s < uSamples; s++)
    {
        vec2 offset = vec2(random(uv + vec2(s)), random(uv - vec2(s))) / uViewportSize.y;
        vec3 rayDirection = getRayDirection(offset);

        Ray r = Ray(uCameraPosition, rayDirection);

        color += getColor(r, uv + vec2(s));
    }

    color /= float(uSamples);

    // Apply gamma correction.
    float gamma = 2.2;
    color = pow(color, vec3(1.0 / gamma));

    FragColor = vec4(color, 1.0); // Final pixel color.
}
