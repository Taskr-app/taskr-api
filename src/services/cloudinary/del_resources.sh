# chmod +x ./src/services/cloudinary/del_resouces.sh
# Make sure to change the api keys with the proper env variables
# https://<API KEY>:<API SECRET>@api.cloudinary.com/v1_1/<cloud-name>/resources/image/upload
curl \
  -d "all=true" \
  -X DELETE \
  https://674378948262982:g2oWfwApcaJzggsKrqTTNOxPqxk@api.cloudinary.com/v1_1/taskr-dev/resources/image/upload
