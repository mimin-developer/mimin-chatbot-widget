import { EyeIcon, EyeOffIcon, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useConfigStore } from "../../hooks/config-store";
import { API } from "../../services";
import { isAxiosError } from "axios";
import { isValid, format } from "date-fns";

interface IProps {
  onClickSignin: () => void;
}

interface CustomerField {
  _id: string;
  field: string;
  slug: string;
  is_required: boolean;
  data_type: "String" | "string" | "Number" | "number" | "Object" | "object" | "Date" | "date" | "Boolean" | "boolean" | "field" | "Password" | "password";
  is_hidden: boolean;
  hide?: boolean;
}

const excludedFields = [
  "otp",
  "_id",
  "__v",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
  "deleted_at",
];

const RegisterSection = ({ onClickSignin }: IProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingFields, setFetchingFields] = useState(true);
  const [customerFields, setCustomerFields] = useState<CustomerField[]>([]);
  const [activeTab, setActiveTab] = useState<"required" | "optional">("required");
  const { config } = useConfigStore();

  const { requiredFields, optionalFields } = useMemo(() => {
    if (!Array.isArray(customerFields)) return { requiredFields: [], optionalFields: [] };

    const filtered = customerFields.filter(
      (field) => !excludedFields.includes(field.slug) && !field.is_hidden && field.slug !== 'is_activated'
    );

    const nonPasswords = filtered.filter(
      (f) => f.data_type.toLowerCase() !== "password" && f.slug.toLowerCase() !== "password"
    );

    return {
      requiredFields: nonPasswords.filter((f) => f.is_required),
      optionalFields: nonPasswords.filter((f) => !f.is_required),
    };
  }, [customerFields]);

  const generateDynamicSchema = (fields: CustomerField[]) => {
    const schemaObject: Record<string, any> = {};

    fields.forEach((field) => {
      const fieldName = field.slug;
      if (!field.data_type || excludedFields.includes(fieldName)) return;

      let fieldSchema;

      switch (field.data_type.toLowerCase()) {
        case "string":
          fieldSchema = z.string();
          if (field.is_required) fieldSchema = fieldSchema.min(1, `${field.field} is required`);
          break;
        case "number":
          fieldSchema = z.number().refine((val) => !isNaN(val), { message: `${field.field} must be a number` });
          break;
        case "boolean":
          fieldSchema = z
            .enum(["true", "false"])
            .transform((val: string) => val === "true");
          break;
        case "object":
          fieldSchema = z.any();
          break;
        case "date":
          fieldSchema = z.preprocess(
            (val: unknown) => {
              if (val instanceof Date) return format(val, 'yyyy-MM-dd');
              if (typeof val === 'string' && val.length > 0) return val;
              return undefined;
            },
            z.string().optional()
          );
          break;
        case "password":
          fieldSchema = z.string().min(6, "Password must be at least 6 characters");
          break;
        default:
          fieldSchema = z.any();
      }

      schemaObject[fieldName] = field.is_required
        ? fieldSchema
        : fieldSchema.optional();
    });

    schemaObject["password"] = z.string().min(6, "Password must be at least 6 characters");
    schemaObject["confirmPassword"] = z.string().min(1, "Confirm password is required");
    schemaObject["acceptTerms"] = z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and conditions",
    });

    return z
      .object(schemaObject)
      .refine((data: Record<string, any>) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
  };

  const form = useForm<Record<string, any>>({
    resolver: zodResolver(generateDynamicSchema(customerFields)),
    defaultValues: {
      acceptTerms: false,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = form;

  useEffect(() => {
    const fetchFields = async () => {
      setFetchingFields(true);
      try {
        const res = await API("axios", "customer")({
          method: "GET",
          url: `/v1/customer-field/get-by-username/${config?.credentials?.username}`,
          headers: { 'x-api-key': config?.credentials?.apiKey },
          params: { order: "_id" },
        });
        const data = res.data?.data || [];
        setCustomerFields(data);
      } catch (error) {
        setErrorMessage("Failed to load registration fields");
      } finally {
        setFetchingFields(false);
      }
    };
    fetchFields();
  }, [config?.credentials?.username]);

  useEffect(() => {
    if (fetchingFields || !customerFields.length) return;
    const filtered = customerFields.filter(
      (field) => !excludedFields.includes(field.slug) && !field.is_hidden && field.slug !== 'is_activated'
    );
    filtered.forEach((field) => {
      const type = field.data_type.toLowerCase();
      switch (type) {
        case "boolean":
          setValue(field.slug, "false");
          break;
        case "object":
          setValue(field.slug, "{}");
          break;
        case "number":
          setValue(field.slug, 0);
          break;
        default:
          setValue(field.slug, "");
      }
    });
  }, [fetchingFields, customerFields]);

  const onSubmit = async (values: Record<string, any>) => {
    setLoading(true);
    setErrorMessage(null);

    const processedValues = { ...values };
    customerFields.forEach((field) => {
      const normalizedDataType = field.data_type.toLowerCase();
      if (
        normalizedDataType === "boolean" &&
        processedValues[field.slug] !== undefined
      ) {
        processedValues[field.slug] =
          processedValues[field.slug] === "true" ||
          processedValues[field.slug] === true;
      } else if (
        normalizedDataType === "object" &&
        processedValues[field.slug]
      ) {
        try {
          const parsedValue =
            typeof processedValues[field.slug] === "string"
              ? JSON.parse(processedValues[field.slug])
              : processedValues[field.slug];
          processedValues[field.slug] = parsedValue;
        } catch (e) {
          processedValues[field.slug] = processedValues[field.slug] || {};
        }
      } else if (
        normalizedDataType === "number" &&
        processedValues[field.slug] !== undefined
      ) {
        processedValues[field.slug] = Number(processedValues[field.slug]) || 0;
      } else if (normalizedDataType === "date" && processedValues[field.slug]) {
        processedValues[field.slug] = isValid(
          new Date(processedValues[field.slug])
        )
          ? processedValues[field.slug]
          : null;
      }
    });

    delete processedValues.confirmPassword;
    delete processedValues.acceptTerms;

    try {
      await API("axios", "customer")({
        method: "POST",
        url: `/v1/customer/create/${config?.credentials?.username}`,
        headers: {
          'x-api-key': config?.credentials?.apiKey,
        },
        data: { ...processedValues, is_activated: true, account_deactivated: false },
      });

      onClickSignin();
    } catch (error) {
      if (isAxiosError(error)) {
        setErrorMessage(error.response?.data?.message || "Registration failed");
      } else {
        setErrorMessage((error as Error).message || "An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const mainColor = config?.theme?.chatWindow?.greating?.color || "#0096A2";

  const renderField = (field: CustomerField) => {
    const type = field.data_type.toLowerCase();
    return (
      <div key={field._id} className="mimin:flex mimin:flex-col mimin:gap-1">
        <label htmlFor={field.slug} className="mimin:text-sm mimin:font-medium">
          {field.field}
          {field.is_required && <sup className="mimin:text-destructive">*</sup>}
        </label>
        {(() => {
          switch (type) {
            case "boolean":
              return (
                <select
                  {...register(field.slug)}
                  id={field.slug}
                  className="mimin:border mimin:rounded-md mimin:p-2 mimin:focus:outline mimin:focus:outline-1 mimin:bg-white"
                  style={{ borderColor: mainColor, outlineColor: mainColor }}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              );
            case "date":
              return (
                <input
                  {...register(field.slug)}
                  type="date"
                  id={field.slug}
                  className="mimin:border mimin:rounded-md mimin:p-2 mimin:focus:outline mimin:focus:outline-1 mimin:bg-white"
                  style={{ borderColor: mainColor, outlineColor: mainColor }}
                />
              );
            case "number":
              return (
                <input
                  {...register(field.slug, {
                    valueAsNumber: true,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = e.target.value;
                      const isNumeric = /^\d*$/.test(value);
                      if (isNumeric) {
                        setValue(field.slug, value ? Number(value) : undefined, {
                          shouldValidate: true,
                        });
                      }
                    },
                  })}
                  type="number"
                  id={field.slug}
                  placeholder={`Enter ${field.field}`}
                  className="mimin:border mimin:rounded-md mimin:p-2 mimin:focus:outline mimin:focus:outline-1"
                  style={{ borderColor: mainColor, outlineColor: mainColor }}
                />
              );
            default:
              return (
                <input
                  {...register(field.slug)}
                  type="text"
                  id={field.slug}
                  placeholder={field.slug.includes("phone") ? "e.g. 08123456789" : `Enter ${field.field}`}
                  className="mimin:border mimin:rounded-md mimin:p-2 mimin:focus:outline mimin:focus:outline-1"
                  style={{ borderColor: mainColor, outlineColor: mainColor }}
                />
              );
          }
        })()}
        {errors[field.slug] && (
          <p className="mimin:text-xs mimin:text-red-500">{errors[field.slug]?.message as string}</p>
        )}
      </div>
    );
  };

  if (fetchingFields) {
    return (
      <div className="mimin:flex mimin:flex-col mimin:items-center mimin:justify-center mimin:p-10 mimin:gap-3">
        <LoaderCircle className="mimin:w-8 mimin:h-8 mimin:animate-spin" style={{ color: mainColor }} />
        <p className="mimin:text-gray-500 mimin:text-sm">Loading registration form...</p>
      </div>
    );
  }

  return (
    <>
      <div className="mimin:flex mimin:justify-center mimin:items-center mimin:w-full mimin:h-auto">
        <img
          src="https://res.cloudinary.com/dctqloe37/image/upload/v1752455653/undraw_chat_qmyo_1_wwzcjj.svg"
          alt=" "
          width={1000}
          height={1000}
          loading="lazy"
          className="mimin:w-full mimin:h-auto mimin:object-cover mimin:object-center"
        />
      </div>
      <div className="mimin:mt-10">
        <div className="mimin:space-y-2">
          <h2 className="mimin:text-base mimin:font-bold">Create Account</h2>
          <p className="mimin:text-sm mimin:text-gray-500">
            Fill your information below to create your account
          </p>
        </div>

        {optionalFields.length > 0 && (
          <div className="mimin:flex mimin:gap-2 mimin:mt-4 mimin:mb-2">
            <button
              type="button"
              onClick={() => setActiveTab("required")}
              className="mimin:px-3 mimin:py-1.5 mimin:text-sm mimin:rounded-md mimin:transition"
              style={{
                backgroundColor: activeTab === "required" ? mainColor : "transparent",
                color: activeTab === "required" ? "white" : mainColor,
                border: `1px solid ${mainColor}`,
              }}
            >
              Required ({requiredFields.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("optional")}
              className="mimin:px-3 mimin:py-1.5 mimin:text-sm mimin:rounded-md mimin:transition"
              style={{
                backgroundColor: activeTab === "optional" ? mainColor : "transparent",
                color: activeTab === "optional" ? "white" : mainColor,
                border: `1px solid ${mainColor}`,
              }}
            >
              Optional ({optionalFields.length})
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mimin:space-y-2 mimin:mt-4">
          {activeTab === "required" && requiredFields.map(renderField)}
          {activeTab === "optional" && optionalFields.map(renderField)}

          <div className="mimin:flex mimin:flex-col mimin:gap-1">
            <label htmlFor="password" className="mimin:text-sm mimin:font-medium">
              Password <sup className="mimin:text-destructive">*</sup>
            </label>
            <div className="mimin:relative">
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Min 6 characters"
                className="mimin:border mimin:rounded-md mimin:p-2 mimin:w-full mimin:focus:outline mimin:focus:outline-1"
                style={{ borderColor: mainColor, outlineColor: mainColor }}
              />
              <button
                type="button"
                className="mimin:absolute mimin:right-2.5 mimin:top-1/2 -mimin:translate-y-1/2 mimin:text-gray-500"
                onClick={() => setShowPassword((e) => !e)}
              >
                {showPassword ? (
                  <EyeIcon className="mimin:w-4 mimin:h-4" />
                ) : (
                  <EyeOffIcon className="mimin:w-4 mimin:h-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mimin:text-xs mimin:text-red-500">{errors.password.message as string}</p>
            )}
          </div>

          <div className="mimin:flex mimin:flex-col mimin:gap-1">
            <label htmlFor="confirmPassword" className="mimin:text-sm mimin:font-medium">
              Confirm Password <sup className="mimin:text-destructive">*</sup>
            </label>
            <div className="mimin:relative">
              <input
                {...register("confirmPassword")}
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirm your password"
                className="mimin:border mimin:rounded-md mimin:p-2 mimin:w-full mimin:focus:outline mimin:focus:outline-1"
                style={{ borderColor: mainColor, outlineColor: mainColor }}
              />
              <button
                type="button"
                className="mimin:absolute mimin:right-2.5 mimin:top-1/2 -mimin:translate-y-1/2 mimin:text-gray-500"
                onClick={() => setShowConfirmPassword((e) => !e)}
              >
                {showConfirmPassword ? (
                  <EyeIcon className="mimin:w-4 mimin:h-4" />
                ) : (
                  <EyeOffIcon className="mimin:w-4 mimin:h-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mimin:text-xs mimin:text-red-500">{errors.confirmPassword.message as string}</p>
            )}
          </div>

          <div className="mimin:flex mimin:items-start mimin:gap-3 mimin:py-2">
            <input
              {...register("acceptTerms")}
              type="checkbox"
              id="acceptTerms"
              className="mimin:mt-1 mimin:size-3.5"
              style={{ accentColor: mainColor }}
            />
            <label className="mimin:block mimin:text-xs mimin:text-gray-500" htmlFor="acceptTerms">
              By creating an account, you agree to our{" "}
              <a href="#" className="mimin:underline" style={{ color: mainColor }}>
                Terms of Service
              </a>
            </label>
          </div>
          {errors.acceptTerms && <p className="mimin:text-xs mimin:text-red-500">{errors.acceptTerms.message as string}</p>}

          {errorMessage && (
            <div className="mimin:flex mimin:items-start mimin:gap-3 mimin:bg-[#F26075]/10 mimin:p-2 mimin:rounded-md mimin:mt-2 mimin:border mimin:border-[#F26075]/20">
              <div className="mimin:flex mimin:items-start mimin:justify-center mimin:pt-1">
                <TriangleAlert className="mimin:w-4 mimin:h-4 mimin:text-[#F26075]" />
              </div>
              <p className="mimin:text-[#F26075] mimin:text-sm">{errorMessage}</p>
            </div>
          )}

          <div className="mimin:flex mimin:flex-col mimin:gap-1 mimin:pb-6 mimin:pt-2">
            <button
              type="submit"
              className="mimin:text-white mimin:px-4 mimin:py-2 mimin:rounded-md mimin:w-full mimin:flex mimin:justify-center mimin:items-center mimin:gap-2 mimin:cursor-pointer mimin:disabled:opacity-50 mimin:disabled:cursor-not-allowed mimin:transition-opacity"
              style={{ backgroundColor: mainColor }}
              disabled={loading}
            >
              {loading && <LoaderCircle className="mimin:w-4 mimin:h-4 mimin:animate-spin" />}
              {loading ? "Creating Account..." : "Create Account"}
            </button>
            <div className="mimin:text-xs mimin:text-center mimin:text-gray-500 mimin:mt-2">
              Already have an account?{" "}
              <button
                type="button"
                onClick={onClickSignin}
                className="mimin:inline mimin:underline mimin:cursor-pointer"
                style={{ color: mainColor }}
              >
                Sign in
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

export default RegisterSection;
